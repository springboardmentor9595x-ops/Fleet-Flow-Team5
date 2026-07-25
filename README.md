# 🚛 FleetFlow Backend

FleetFlow is a Fleet Management System developed using **FastAPI** and **PostgreSQL**. It helps manage users, drivers, vehicles, trips, shipments, attendance, GPS tracking, fuel records, maintenance, and notifications.

This repository currently contains the **Backend implementation completed up to Step 7**, including JWT Authentication.

---

# 📌 Project Status

✅ Backend Setup Completed

- ✔ Project Structure
- ✔ Environment Configuration
- ✔ PostgreSQL Database Configuration
- ✔ SQLAlchemy ORM Models
- ✔ Alembic Database Migrations
- ✔ FastAPI Application Setup
- ✔ JWT Authentication
- ✔ User Signup API
- ✔ User Login API
- ✔ Protected Route (/auth/me)

Current Progress:
- ✅ Completed up to **Step 7**

---

# 🚀 Tech Stack

- Python 3.12+
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- JWT Authentication
- Passlib (bcrypt)
- Pydantic
- Uvicorn

---

# 📁 Project Structure

```
backend/
│
├── alembic/
│   ├── versions/
│   └── env.py
│
├── app/
│   ├── core/
│   │   ├── security.py
│   │   └── deps.py
│   │
│   ├── crud/
│   │   └── user.py
│   │
│   ├── models/
│   │   ├── user.py
│   │   ├── driver.py
│   │   ├── vehicle.py
│   │   ├── trip.py
│   │   ├── shipment.py
│   │   ├── attendance.py
│   │   ├── gps_tracking.py
│   │   ├── maintenance.py
│   │   ├── fuel_record.py
│   │   └── notification.py
│   │
│   ├── routers/
│   │   └── auth.py
│   │
│   ├── schemas/
│   │   └── user.py
│   │
│   ├── config.py
│   ├── database.py
│   └── main.py
│
├── requirements.txt
├── alembic.ini
└── .env
```

---

# ⚙ Installation

Clone the repository

```bash
git clone <repository-url>
```

Move to backend folder

```bash
cd backend
```

Create Virtual Environment

```bash
python -m venv venv
```

Activate Virtual Environment

Windows

```bash
venv\Scripts\activate
```

Install Dependencies

```bash
pip install -r requirements.txt
```

---

# 🔐 Environment Variables

Create a `.env` file inside the backend folder.

Example:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/fleetflow_db

SECRET_KEY=your_secret_key

ALGORITHM=HS256

ACCESS_TOKEN_EXPIRE_MINUTES=60

CORS_ORIGINS=http://localhost:5173
```

> **Do not commit your actual `.env` file to GitHub.**

---

# ▶ Running the Application

```bash
uvicorn app.main:app --reload
```

Application URL

```
http://127.0.0.1:8000
```

Swagger Documentation

```
http://127.0.0.1:8000/docs
```

---

# 📡 Available APIs

## Authentication

### POST /auth/signup

Register a new user.

### POST /auth/login

Login using email and password.

Returns JWT Access Token.

### GET /auth/me

Protected API.

Returns currently logged-in user information.

---

# 🗄 Database Tables

- Users
- Drivers
- Vehicles
- Trips
- Shipments
- Attendance
- GPS Tracking
- Fuel Records
- Vehicle Maintenance
- Notifications

---

# ✅ Testing Completed

✔ User Registration

✔ Duplicate Email Validation

✔ Invalid Input Validation

✔ Login Authentication

✔ Invalid Credentials Validation

✔ JWT Token Generation

✔ Protected Route Authorization

---

# 🔒 Security Features

- Password Hashing using bcrypt
- JWT Authentication
- OAuth2 Password Bearer
- Protected APIs
- Environment Variables
- SQLAlchemy ORM

---

# 📌 Current Milestone

Completed:

- Step 1
- Step 2
- Step 3
- Step 4
- Step 5
- Step 6
- Step 7

Upcoming:

- Step 8 – API Testing
- Step 9 – Frontend Development
- Step 10 – Integration & Deployment

---

# 👩‍💻 Developer

**Nanda Gunasri**

B.Tech – Computer Science Engineering

