import requests
import webbrowser
import time

print("جاهز... قرّب الكارت!")

last_uid = None

while True:
    try:
        response = requests.get("http://127.0.0.1:32145/v1/readers/0/card")
        data = response.json()
        
        if "uid" in data and data.get("data"):
            uid = data["uid"]
            url = data.get("data")
            
            if uid != last_uid and url.startswith("http"):
                print(f"فتح: {url}")
                webbrowser.open(url)
                last_uid = uid
        else:
            last_uid = None
            
    except:
        pass
    
    time.sleep(0.5)