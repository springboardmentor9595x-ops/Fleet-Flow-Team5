import time
import httpx

unique_id = int(time.time())
payload = {
    'full_name': 'Test User',
    'email': f'testuser_{unique_id}@example.com',
    'password': 'StrongPass123!',
    'phone': '5551234567',
    'role': 'Driver'
}

response = httpx.post('http://127.0.0.1:8000/auth/signup', json=payload, timeout=10)
print('Status:', response.status_code)
print('Response:', response.text)

