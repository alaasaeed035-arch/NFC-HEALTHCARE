from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from groq import Groq
import requests
import json
import re
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from datetime import datetime
import logging
import traceback
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# ==================== MONGODB SETUP ====================
# MongoDB connection
MONGODB_URI = os.getenv("MONGO_URI", "mongodb+srv://bodytarek2003_db_user:bPzJxGCug6LhNKxl@cluster0.qkbfket.mongodb.net/nfc-healthcare?appName=Cluster0")
mongo_client = None
db = None

async def init_mongodb():
    """Initialize MongoDB connection and create indexes"""
    global mongo_client, db
    try:
        mongo_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        db = mongo_client.get_database()
        
        # Test connection
        await mongo_client.admin.command('ping')
        
        # Create indexes for better query performance
        await db.conflict_analyses.create_index([("patient_id", ASCENDING)])
        await db.conflict_analyses.create_index([("created_at", DESCENDING)])
        await db.conflict_analyses.create_index([("patient_name", ASCENDING)])
        
        logger.info("✅ MongoDB connected successfully")
        logger.info(f"Database: {db.name}")
    except Exception as e:
        logger.warning(f"⚠️ MongoDB connection failed: {e}")
        logger.warning("⚠️ AI service will run without MongoDB logging")
        mongo_client = None
        db = None

async def close_mongodb():
    """Close MongoDB connection"""
    global mongo_client
    if mongo_client:
        mongo_client.close()
        logger.info("MongoDB connection closed")

app = FastAPI(title="Medical Treatment Conflict Checker")

# CORS middleware - Allow Node.js backend to access this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify: ["http://localhost:3000", "your-frontend-domain"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client - Use environment variable for API key
GROQ_API_KEY = os.getenv("DDI_GROQ_API_KEY")
if not GROQ_API_KEY:
    print("⚠️  WARNING: DDI_GROQ_API_KEY not found in environment variables!")
    print("   The DDI service will not function without a valid API key.")
    print("   Please set DDI_GROQ_API_KEY in your .env file")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# ==================== DRUG INFORMATION SERVICE ====================

class DrugInfoService:
    """Service to fetch drug information from free government APIs"""
    
    FDA_BASE_URL = "https://api.fda.gov/drug/label.json"
    RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST"
    
    @classmethod
    def get_rxcui(cls, drug_name: str) -> Optional[str]:
        """Get RxCUI (unique identifier) for a drug from RxNorm"""
        try:
            url = f"{cls.RXNORM_BASE_URL}/rxcui.json?name={drug_name}"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            if 'idGroup' in data and 'rxnormId' in data['idGroup']:
                return data['idGroup']['rxnormId'][0]
        except Exception as e:
            print(f"RxNorm RxCUI Error: {e}")
        return None
    
    @classmethod
    def get_fda_drug_info(cls, drug_name: str) -> Optional[Dict]:
        """Get comprehensive drug info from OpenFDA"""
        try:
            clean_name = drug_name.strip().lower()
            url = f"{cls.FDA_BASE_URL}?search=openfda.brand_name:\"{clean_name}\"+openfda.generic_name:\"{clean_name}\"&limit=1"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if 'results' in data and len(data['results']) > 0:
                    result = data['results'][0]
                    
                    def get_field(field_name):
                        field = result.get(field_name)
                        if field and isinstance(field, list) and len(field) > 0:
                            text = field[0]
                            return text[:500] + "..." if len(text) > 500 else text
                        return None
                    
                    return {
                        "brand_name": result.get('openfda', {}).get('brand_name', [drug_name])[0] if result.get('openfda', {}).get('brand_name') else drug_name,
                        "generic_name": result.get('openfda', {}).get('generic_name', ['N/A'])[0] if result.get('openfda', {}).get('generic_name') else None,
                        "indications": get_field('indications_and_usage'),
                        "dosage": get_field('dosage_and_administration'),
                        "warnings": get_field('warnings'),
                        "adverse_reactions": get_field('adverse_reactions'),
                        "contraindications": get_field('contraindications'),
                        "drug_interactions": get_field('drug_interactions'),
                        "storage": get_field('storage_and_handling'),
                        "manufacturer": result.get('openfda', {}).get('manufacturer_name', ['N/A'])[0] if result.get('openfda', {}).get('manufacturer_name') else None,
                        "route": result.get('openfda', {}).get('route', [None])[0] if result.get('openfda', {}).get('route') else None,
                    }
        except Exception as e:
            print(f"FDA API Error for {drug_name}: {e}")
        
        return None
    
    @classmethod
    def get_rxnorm_interactions(cls, rxcui: str) -> Optional[list]:
        """Get known drug interactions for a rxcui from RxNorm"""
        try:
            url = f"{cls.RXNORM_BASE_URL}/interaction/interaction.json?rxcui={rxcui}"
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                return None
            data = response.json()
            interactions = []
            for group in data.get("interactionTypeGroup", []):
                source = group.get("sourceName", "")
                for itype in group.get("interactionType", []):
                    for pair in itype.get("interactionPair", []):
                        concepts = pair.get("interactionConcept", [])
                        names = [c.get("minConceptItem", {}).get("name", "") for c in concepts]
                        interactions.append({
                            "drugs": names,
                            "severity": pair.get("severity", "unknown"),
                            "description": pair.get("description", ""),
                            "source": source,
                        })
            return interactions if interactions else None
        except Exception as e:
            print(f"RxNorm Interaction Error: {e}")
        return None

    @classmethod
    def get_complete_drug_info(cls, drug_name: str) -> Dict:
        """Get comprehensive drug information from all sources"""
        fda_info = cls.get_fda_drug_info(drug_name)
        rxnorm_info = cls.get_rxcui(drug_name)
        rxnorm_interactions = cls.get_rxnorm_interactions(rxnorm_info) if rxnorm_info else None

        return {
            "drug_name": drug_name,
            "fda_information": fda_info,
            "rxnorm_information": {"rxcui": rxnorm_info, "interactions": rxnorm_interactions} if rxnorm_info else None,
            "has_data": bool(fda_info or rxnorm_info)
        }

# ==================== DATA MODELS ====================

class Treatment(BaseModel):
    name: str
    dosage: str
    frequency: str
    notes: Optional[str] = ""

class Patient(BaseModel):
    id: Optional[str] = None
    name: str
    age: int
    current_treatments: List[Treatment]

class ConflictCheckRequest(BaseModel):
    patient: Patient
    new_treatment: Treatment

class DrugInformation(BaseModel):
    drug_name: str
    fda_information: Optional[Dict]
    rxnorm_information: Optional[Dict]
    has_data: bool

class ConflictCheckResponse(BaseModel):
    has_conflict: bool
    severity: str
    analysis: str
    recommendations: List[str]
    interactions: List[str]
    new_treatment_info: Optional[DrugInformation] = None

# ==================== ENDPOINTS ====================

@app.get("/drug-info/{drug_name}", response_model=DrugInformation)
async def get_drug_information(drug_name: str):
    """Get comprehensive drug information from FDA and RxNorm APIs"""
    
    info = DrugInfoService.get_complete_drug_info(drug_name)
    
    if not info['has_data']:
        raise HTTPException(
            status_code=404, 
            detail=f"No information found for drug: {drug_name}"
        )
    
    return DrugInformation(**info)

async def analyze_conflict_with_ai(prompt: str, patient_age: int, num_treatments: int) -> Dict:
    """Perform AI analysis"""
    
    # Check if Groq client is initialized
    if not client:
        raise HTTPException(
            status_code=503,
            detail="AI service is not configured. Please set GROQ_API_KEY environment variable."
        )
    
    # Call Groq API
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are an expert clinical pharmacist. Provide accurate, evidence-based analysis. Respond with valid JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.2,
        max_tokens=2000
    )
    
    ai_response = completion.choices[0].message.content

    # Parse JSON response
    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
    if json_match:
        result = json.loads(json_match.group())
    else:
        result = {
            "has_conflict": "interaction" in ai_response.lower(),
            "severity": "moderate",
            "analysis": ai_response,
            "recommendations": ["Consult healthcare provider"],
            "interactions": []
        }
    
    return result

@app.post("/check-conflict", response_model=ConflictCheckResponse)
async def check_treatment_conflict(request: ConflictCheckRequest):
    """
    Check treatment conflicts with optional observability
    Works with or without Langfuse installed
    """
    logger.info(f"Received conflict check request for patient: {request.patient.name}")
    
    try:
        # Fetch drug information for all drugs in parallel
        loop = asyncio.get_running_loop()
        drug_names = [request.new_treatment.name] + [t.name for t in request.patient.current_treatments]
        with ThreadPoolExecutor() as executor:
            drug_infos = await asyncio.gather(
                *[loop.run_in_executor(executor, DrugInfoService.get_complete_drug_info, name)
                  for name in drug_names]
            )
        new_drug_info = drug_infos[0]
        current_drugs_info = list(drug_infos[1:])
        
        # Build prompt
        current_treatments_text = "\n".join([
            f"- {t.name} ({t.dosage}, {t.frequency})" + (f" - {t.notes}" if t.notes else "")
            for t in request.patient.current_treatments
        ])
        
        new_treatment_text = f"{request.new_treatment.name} ({request.new_treatment.dosage}, {request.new_treatment.frequency})"
        
        # Add FDA + RxNorm data to prompt
        additional_context = "\n\n=== DRUG INFORMATION FROM FDA & RXNORM ===\n"
        has_fda_context = False

        def _append_drug_context(label: str, info: dict) -> bool:
            nonlocal additional_context
            added = False
            fda = info.get("fda_information") or {}
            if fda.get("warnings"):
                additional_context += f"\n{label}:\n- Warnings: {fda['warnings'][:300]}...\n"
                added = True
            if fda.get("drug_interactions"):
                additional_context += f"- FDA Interactions: {fda['drug_interactions'][:300]}...\n"
                added = True
            rxn = (info.get("rxnorm_information") or {}).get("interactions") or []
            if rxn:
                additional_context += f"- RxNorm Known Interactions:\n"
                for ix in rxn[:5]:
                    drugs_str = " + ".join(filter(None, ix["drugs"]))
                    additional_context += f"  [{ix['severity'].upper()}] {drugs_str}: {ix['description']}\n"
                added = True
            return added

        if new_drug_info['has_data']:
            if _append_drug_context(f"New Treatment ({request.new_treatment.name})", new_drug_info):
                has_fda_context = True

        for info in current_drugs_info:
            if info['has_data']:
                if _append_drug_context(f"Existing Drug ({info['drug_name']})", info):
                    has_fda_context = True

        prompt = f"""Analyze potential drug interactions and treatment conflicts.

Patient: {request.patient.name}, Age {request.patient.age}

Current Treatments:
{current_treatments_text if current_treatments_text else "None"}

Proposed New Treatment:
{new_treatment_text}

{additional_context if has_fda_context else ""}

Respond in JSON format:
{{
    "has_conflict": true/false,
    "severity": "none/low/moderate/high/critical",
    "analysis": "detailed explanation",
    "recommendations": ["recommendation 1", "recommendation 2"],
    "interactions": ["interaction 1", "interaction 2"]
}}"""

        # Perform AI analysis
        result = await analyze_conflict_with_ai(
            prompt, 
            request.patient.age, 
            len(request.patient.current_treatments)
        )
        
        response_obj = ConflictCheckResponse(
            has_conflict=result.get("has_conflict", False),
            severity=result.get("severity", "none"),
            analysis=result.get("analysis", ""),
            recommendations=result.get("recommendations", []),
            interactions=result.get("interactions", []),
            new_treatment_info=DrugInformation(**new_drug_info) if new_drug_info['has_data'] else None
        )

        return response_obj
        
    except Exception as e:
        logger.error(f"Error in /check-conflict: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ==================== STARTUP & SHUTDOWN EVENTS ====================

@app.on_event("startup")
async def startup_event():
    """Initialize MongoDB connection on startup"""
    await init_mongodb()
    logger.info("🚀 FastAPI AI Service started")

@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on shutdown"""
    await close_mongodb()
    logger.info("👋 FastAPI AI Service stopped")

# ==================== RUN SERVER ====================


if __name__ == "__main__":
    import uvicorn
    print("📦 Using MongoDB for conflict analysis logging")
    uvicorn.run(app, host="0.0.0.0", port=8000)