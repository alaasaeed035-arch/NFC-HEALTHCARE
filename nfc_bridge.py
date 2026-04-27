"""
Local NFC bridge service for ACR122U-A9 reader.

Reads the card UID directly via PC/SC (no external reader software needed).
Exposes a CORS-enabled HTTP endpoint so the browser frontend can poll it.

Install once:
    pip install pyscard fastapi uvicorn

Run before opening the receptionist page:
    python nfc_bridge.py
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from smartcard.System import readers as list_readers
    PYSCARD_OK = True
except ImportError:
    PYSCARD_OK = False

# APDU command: Get card UID (works for MIFARE, NTAG, ISO 14443-A/B)
GET_UID = [0xFF, 0xCA, 0x00, 0x00, 0x00]

app = FastAPI(title="NFC Bridge")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _read_uid() -> dict:
    if not PYSCARD_OK:
        return {
            "uid": None,
            "present": False,
            "reader_available": False,
            "error": "pyscard not installed — run: pip install pyscard",
        }

    try:
        available = list_readers()
    except Exception as e:
        return {"uid": None, "present": False, "reader_available": False, "error": str(e)}

    if not available:
        return {
            "uid": None,
            "present": False,
            "reader_available": False,
            "error": "No NFC reader detected — plug in the ACR122U",
        }

    # Reader is plugged in. Try to connect to a card on it.
    connection = available[0].createConnection()
    try:
        connection.connect()
    except Exception:
        # Reader is fine but no card is present on it
        return {"uid": None, "present": False, "reader_available": True}

    try:
        data, sw1, sw2 = connection.transmit(GET_UID)
        connection.disconnect()
        if sw1 == 0x90 and sw2 == 0x00:
            uid = "".join(f"{b:02X}" for b in data)
            return {"uid": uid, "present": True, "reader_available": True}
        return {"uid": None, "present": False, "reader_available": True}
    except Exception:
        return {"uid": None, "present": False, "reader_available": True}


@app.get("/nfc/card")
def get_card():
    return _read_uid()


@app.get("/health")
def health():
    readers_found = []
    if PYSCARD_OK:
        try:
            readers_found = [str(r) for r in list_readers()]
        except Exception:
            pass
    return {"status": "ok", "pyscard": PYSCARD_OK, "readers": readers_found}


if __name__ == "__main__":
    if not PYSCARD_OK:
        print("ERROR: pyscard is not installed.")
        print("Fix: pip install pyscard")
    else:
        print("pyscard OK")
    print("NFC Bridge starting on http://localhost:8002")
    uvicorn.run(app, host="127.0.0.1", port=8002)
