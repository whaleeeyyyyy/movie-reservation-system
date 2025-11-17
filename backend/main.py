"""
Movie Reservation System - FastAPI Backend
Fixed version with bcrypt compatibility
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import IntegrityError
import bcrypt  # Changed from passlib to bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta, date, time
from typing import List, Optional
from pydantic import BaseModel, EmailStr
import uuid
import random
import string
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database Configuration
DB_USERNAME = os.getenv("dB_USERNAME")
DB_PASSWORD = os.getenv("dB_PASSWORD")
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = os.getenv("dB_NAME")
DATABASE_URL = f"postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Security Configuration
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

security = HTTPBearer()

app = FastAPI(title="Movie Reservation API")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str

class MovieCreate(BaseModel):
    title: str
    description: Optional[str]
    poster_image: Optional[str]
    genre: str
    duration_minutes: int
    release_date: Optional[date]
    rating: Optional[str]

class MovieResponse(MovieCreate):
    id: str
    is_active: bool

class ShowtimeCreate(BaseModel):
    movie_id: str
    theater_id: str
    show_date: date
    show_time: time
    price: float

class ShowtimeResponse(ShowtimeCreate):
    id: str
    is_active: bool
    movie_title: Optional[str] = None
    theater_name: Optional[str] = None
    available_seats: Optional[int] = None

class SeatResponse(BaseModel):
    id: str
    row_label: str
    seat_number: int
    seat_type: str
    is_available: bool

class ReservationCreate(BaseModel):
    showtime_id: str
    seat_ids: List[str]

class ReservationResponse(BaseModel):
    id: str
    booking_reference: str
    showtime_id: str
    movie_title: str
    show_date: date
    show_time: time
    theater_name: str
    seats: List[dict]
    total_price: float
    status: str
    created_at: datetime

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Utility Functions - FIXED BCRYPT IMPLEMENTATION
def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password using bcrypt"""
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_booking_reference() -> str:
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

# Authentication Dependencies
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    result = db.execute(
        text("SELECT id, email, full_name, role FROM users WHERE id = :id"),
        {"id": user_id}
    ).fetchone()
    
    if result is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return {
        "id": str(result[0]),
        "email": result[1],
        "full_name": result[2],
        "role": result[3]
    }

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Authentication Endpoints
@app.post("/api/auth/signup", response_model=UserResponse)
async def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    existing = db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": user.email}
    ).fetchone()
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = hash_password(user.password)
    result = db.execute(
        text("""
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (:email, :password_hash, :full_name, 'user')
            RETURNING id, email, full_name, role
        """),
        {
            "email": user.email,
            "password_hash": hashed_password,
            "full_name": user.full_name
        }
    )
    db.commit()
    
    user_data = result.fetchone()
    return UserResponse(
        id=str(user_data[0]),
        email=user_data[1],
        full_name=user_data[2],
        role=user_data[3]
    )

@app.post("/api/auth/login")
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    result = db.execute(
        text("SELECT id, email, password_hash, full_name, role FROM users WHERE email = :email"),
        {"email": credentials.email}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(credentials.password, result[2]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": str(result[0])})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(result[0]),
            "email": result[1],
            "full_name": result[3],
            "role": result[4]
        }
    }

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# Movie Endpoints
@app.get("/api/movies", response_model=List[MovieResponse])
async def get_movies(
    genre: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = "SELECT id, title, description, poster_image, genre, duration_minutes, release_date, rating, is_active FROM movies WHERE is_active = true"
    params = {}
    
    if genre:
        query += " AND genre = :genre"
        params["genre"] = genre
    
    query += " ORDER BY release_date DESC"
    
    results = db.execute(text(query), params).fetchall()
    
    return [
        MovieResponse(
            id=str(row[0]),
            title=row[1],
            description=row[2],
            poster_image=row[3],
            genre=row[4],
            duration_minutes=row[5],
            release_date=row[6],
            rating=row[7],
            is_active=row[8]
        )
        for row in results
    ]

@app.get("/api/movies/{movie_id}", response_model=MovieResponse)
async def get_movie(movie_id: str, db: Session = Depends(get_db)):
    result = db.execute(
        text("""
            SELECT id, title, description, poster_image, genre, 
                   duration_minutes, release_date, rating, is_active
            FROM movies WHERE id = :id
        """),
        {"id": movie_id}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    return MovieResponse(
        id=str(result[0]),
        title=result[1],
        description=result[2],
        poster_image=result[3],
        genre=result[4],
        duration_minutes=result[5],
        release_date=result[6],
        rating=result[7],
        is_active=result[8]
    )

@app.post("/api/movies", response_model=MovieResponse)
async def create_movie(
    movie: MovieCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            INSERT INTO movies (title, description, poster_image, genre, 
                               duration_minutes, release_date, rating)
            VALUES (:title, :description, :poster_image, :genre, 
                    :duration_minutes, :release_date, :rating)
            RETURNING id, title, description, poster_image, genre, 
                     duration_minutes, release_date, rating, is_active
        """),
        {
            "title": movie.title,
            "description": movie.description,
            "poster_image": movie.poster_image,
            "genre": movie.genre,
            "duration_minutes": movie.duration_minutes,
            "release_date": movie.release_date,
            "rating": movie.rating
        }
    )
    db.commit()
    
    row = result.fetchone()
    return MovieResponse(
        id=str(row[0]),
        title=row[1],
        description=row[2],
        poster_image=row[3],
        genre=row[4],
        duration_minutes=row[5],
        release_date=row[6],
        rating=row[7],
        is_active=row[8]
    )

@app.put("/api/movies/{movie_id}", response_model=MovieResponse)
async def update_movie(
    movie_id: str,
    movie: MovieCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            UPDATE movies SET
                title = :title,
                description = :description,
                poster_image = :poster_image,
                genre = :genre,
                duration_minutes = :duration_minutes,
                release_date = :release_date,
                rating = :rating
            WHERE id = :id
            RETURNING id, title, description, poster_image, genre, 
                     duration_minutes, release_date, rating, is_active
        """),
        {
            "id": movie_id,
            "title": movie.title,
            "description": movie.description,
            "poster_image": movie.poster_image,
            "genre": movie.genre,
            "duration_minutes": movie.duration_minutes,
            "release_date": movie.release_date,
            "rating": movie.rating
        }
    )
    db.commit()
    
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    return MovieResponse(
        id=str(row[0]),
        title=row[1],
        description=row[2],
        poster_image=row[3],
        genre=row[4],
        duration_minutes=row[5],
        release_date=row[6],
        rating=row[7],
        is_active=row[8]
    )

@app.delete("/api/movies/{movie_id}")
async def delete_movie(
    movie_id: str,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("UPDATE movies SET is_active = false WHERE id = :id RETURNING id"),
        {"id": movie_id}
    )
    db.commit()
    
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Movie not found")
    
    return {"message": "Movie deleted successfully"}

# Showtime Endpoints
@app.get("/api/showtimes")
async def get_showtimes(
    movie_id: Optional[str] = None,
    show_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = """
        SELECT 
            s.id, s.movie_id, s.theater_id, s.show_date, s.show_time, 
            s.price, s.is_active,
            m.title as movie_title,
            t.name as theater_name,
            t.total_seats - COALESCE(COUNT(rs.id), 0) as available_seats
        FROM showtimes s
        JOIN movies m ON s.movie_id = m.id
        JOIN theaters t ON s.theater_id = t.id
        LEFT JOIN reservation_seats rs ON s.id = rs.showtime_id
            AND rs.reservation_id IN (
                SELECT id FROM reservations WHERE status = 'confirmed'
            )
        WHERE s.is_active = true
    """
    params = {}
    
    if movie_id:
        query += " AND s.movie_id = :movie_id"
        params["movie_id"] = movie_id
    
    if show_date:
        query += " AND s.show_date = :show_date"
        params["show_date"] = show_date
    
    query += """ 
        GROUP BY s.id, s.movie_id, s.theater_id, s.show_date, s.show_time,
                 s.price, s.is_active, m.title, t.name, t.total_seats
        ORDER BY s.show_date, s.show_time
    """
    
    results = db.execute(text(query), params).fetchall()
    
    return [
        ShowtimeResponse(
            id=str(row[0]),
            movie_id=str(row[1]),
            theater_id=str(row[2]),
            show_date=row[3],
            show_time=row[4],
            price=float(row[5]),
            is_active=row[6],
            movie_title=row[7],
            theater_name=row[8],
            available_seats=row[9]
        )
        for row in results
    ]

@app.post("/api/showtimes", response_model=ShowtimeResponse)
async def create_showtime(
    showtime: ShowtimeCreate,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        result = db.execute(
            text("""
                INSERT INTO showtimes (movie_id, theater_id, show_date, show_time, price)
                VALUES (:movie_id, :theater_id, :show_date, :show_time, :price)
                RETURNING id, movie_id, theater_id, show_date, show_time, price, is_active
            """),
            {
                "movie_id": showtime.movie_id,
                "theater_id": showtime.theater_id,
                "show_date": showtime.show_date,
                "show_time": showtime.show_time,
                "price": showtime.price
            }
        )
        db.commit()
        
        row = result.fetchone()
        return ShowtimeResponse(
            id=str(row[0]),
            movie_id=str(row[1]),
            theater_id=str(row[2]),
            show_date=row[3],
            show_time=row[4],
            price=float(row[5]),
            is_active=row[6]
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Theater already has a show at this time")

@app.get("/api/showtimes/{showtime_id}/seats", response_model=List[SeatResponse])
async def get_showtime_seats(
    showtime_id: str,
    db: Session = Depends(get_db)
):
    results = db.execute(
        text("""
            SELECT 
                s.id, s.row_label, s.seat_number, s.seat_type,
                CASE WHEN rs.id IS NULL THEN true ELSE false END as is_available
            FROM seats s
            JOIN showtimes sh ON s.theater_id = sh.theater_id
            LEFT JOIN reservation_seats rs ON s.id = rs.seat_id 
                AND rs.showtime_id = :showtime_id
                AND rs.reservation_id IN (
                    SELECT id FROM reservations WHERE status = 'confirmed'
                )
            WHERE sh.id = :showtime_id
            ORDER BY s.row_label, s.seat_number
        """),
        {"showtime_id": showtime_id}
    ).fetchall()
    
    return [
        SeatResponse(
            id=str(row[0]),
            row_label=row[1],
            seat_number=row[2],
            seat_type=row[3],
            is_available=row[4]
        )
        for row in results
    ]

# Reservation Endpoints
@app.post("/api/reservations", response_model=ReservationResponse)
async def create_reservation(
    reservation: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        showtime_result = db.execute(
            text("""
                SELECT s.id, s.price, m.title, s.show_date, s.show_time, t.name
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                JOIN theaters t ON s.theater_id = t.id
                WHERE s.id = :showtime_id AND s.is_active = true
                FOR UPDATE
            """),
            {"showtime_id": reservation.showtime_id}
        ).fetchone()
        
        if not showtime_result:
            raise HTTPException(status_code=404, detail="Showtime not found")
        
        seat_check = db.execute(
            text("""
                SELECT s.id, s.row_label, s.seat_number, s.seat_type
                FROM seats s
                WHERE s.id = ANY(:seat_ids)
                AND NOT EXISTS (
                    SELECT 1 FROM reservation_seats rs
                    JOIN reservations r ON rs.reservation_id = r.id
                    WHERE rs.seat_id = s.id 
                    AND rs.showtime_id = :showtime_id
                    AND r.status = 'confirmed'
                )
                FOR UPDATE OF s
            """),
            {
                "seat_ids": reservation.seat_ids,
                "showtime_id": reservation.showtime_id
            }
        ).fetchall()
        
        if len(seat_check) != len(reservation.seat_ids):
            raise HTTPException(
                status_code=400, 
                detail="One or more seats are not available or do not exist"
            )
        
        total_price = showtime_result[1] * len(reservation.seat_ids)
        booking_ref = generate_booking_reference()
        
        reservation_result = db.execute(
            text("""
                INSERT INTO reservations 
                    (user_id, showtime_id, total_price, booking_reference, status)
                VALUES (:user_id, :showtime_id, :total_price, :booking_ref, 'confirmed')
                RETURNING id, created_at
            """),
            {
                "user_id": current_user["id"],
                "showtime_id": reservation.showtime_id,
                "total_price": total_price,
                "booking_ref": booking_ref
            }
        ).fetchone()
        
        reservation_id = str(reservation_result[0])
        created_at = reservation_result[1]
        
        for seat_id in reservation.seat_ids:
            db.execute(
                text("""
                    INSERT INTO reservation_seats 
                        (reservation_id, showtime_id, seat_id)
                    VALUES (:reservation_id, :showtime_id, :seat_id)
                """),
                {
                    "reservation_id": reservation_id,
                    "showtime_id": reservation.showtime_id,
                    "seat_id": seat_id
                }
            )
        
        db.commit()
        
        seats = [
            {
                "id": str(seat[0]),
                "row_label": seat[1],
                "seat_number": seat[2],
                "seat_type": seat[3]
            }
            for seat in seat_check
        ]
        
        return ReservationResponse(
            id=reservation_id,
            booking_reference=booking_ref,
            showtime_id=reservation.showtime_id,
            movie_title=showtime_result[2],
            show_date=showtime_result[3],
            show_time=showtime_result[4],
            theater_name=showtime_result[5],
            seats=seats,
            total_price=total_price,
            status="confirmed",
            created_at=created_at
        )
        
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Seats are already booked. Please select different seats."
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reservations", response_model=List[ReservationResponse])
async def get_user_reservations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    results = db.execute(
        text("""
            SELECT DISTINCT
                r.id, r.booking_reference, r.showtime_id, r.total_price, 
                r.status, r.created_at,
                m.title as movie_title,
                s.show_date, s.show_time,
                t.name as theater_name
            FROM reservations r
            JOIN showtimes s ON r.showtime_id = s.id
            JOIN movies m ON s.movie_id = m.id
            JOIN theaters t ON s.theater_id = t.id
            WHERE r.user_id = :user_id
            ORDER BY r.created_at DESC
        """),
        {"user_id": current_user["id"]}
    ).fetchall()
    
    reservations = []
    for row in results:
        seats_result = db.execute(
            text("""
                SELECT s.id, s.row_label, s.seat_number, s.seat_type
                FROM reservation_seats rs
                JOIN seats s ON rs.seat_id = s.id
                WHERE rs.reservation_id = :reservation_id
            """),
            {"reservation_id": str(row[0])}
        ).fetchall()
        
        seats = [
            {
                "id": str(seat[0]),
                "row_label": seat[1],
                "seat_number": seat[2],
                "seat_type": seat[3]
            }
            for seat in seats_result
        ]
        
        reservations.append(
            ReservationResponse(
                id=str(row[0]),
                booking_reference=row[1],
                showtime_id=str(row[2]),
                total_price=float(row[3]),
                status=row[4],
                created_at=row[5],
                movie_title=row[6],
                show_date=row[7],
                show_time=row[8],
                theater_name=row[9],
                seats=seats
            )
        )
    
    return reservations

@app.delete("/api/reservations/{reservation_id}")
async def cancel_reservation(
    reservation_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            SELECT r.id, s.show_date, s.show_time
            FROM reservations r
            JOIN showtimes s ON r.showtime_id = s.id
            WHERE r.id = :reservation_id 
            AND r.user_id = :user_id 
            AND r.status = 'confirmed'
        """),
        {
            "reservation_id": reservation_id,
            "user_id": current_user["id"]
        }
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    show_datetime = datetime.combine(result[1], result[2])
    if show_datetime < datetime.now():
        raise HTTPException(status_code=400, detail="Cannot cancel past reservations")
    
    db.execute(
        text("""
            UPDATE reservations 
            SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
            WHERE id = :reservation_id
        """),
        {"reservation_id": reservation_id}
    )
    db.commit()
    
    return {"message": "Reservation cancelled successfully"}

# Admin Reporting Endpoints
@app.get("/api/admin/reports/reservations")
async def get_reservation_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = """
        SELECT * FROM reservation_summary
        WHERE 1=1
    """
    params = {}
    
    if start_date:
        query += " AND show_date >= :start_date"
        params["start_date"] = start_date
    
    if end_date:
        query += " AND show_date <= :end_date"
        params["end_date"] = end_date
    
    query += " ORDER BY show_date, show_time"
    
    results = db.execute(text(query), params).fetchall()
    
    return [
        {
            "showtime_id": str(row[0]),
            "movie_title": row[1],
            "show_date": row[2],
            "show_time": row[3],
            "theater_name": row[4],
            "total_reservations": row[5],
            "seats_booked": row[6],
            "seats_available": row[7],
            "total_revenue": float(row[8]) if row[8] else 0.0
        }
        for row in results
    ]

@app.get("/api/admin/reports/summary")
async def get_summary_report(
    current_user: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            SELECT 
                COUNT(DISTINCT r.id) as total_reservations,
                SUM(r.total_price) as total_revenue,
                COUNT(DISTINCT r.user_id) as total_customers,
                COUNT(DISTINCT rs.seat_id) as total_seats_booked
            FROM reservations r
            LEFT JOIN reservation_seats rs ON r.id = rs.reservation_id
            WHERE r.status = 'confirmed'
        """)
    ).fetchone()
    
    return {
        "total_reservations": result[0] or 0,
        "total_revenue": float(result[1]) if result[1] else 0.0,
        "total_customers": result[2] or 0,
        "total_seats_booked": result[3] or 0
    }

# Theaters Endpoint
@app.get("/api/theaters")
async def get_theaters(db: Session = Depends(get_db)):
    results = db.execute(
        text("SELECT id, name, total_seats FROM theaters")
    ).fetchall()
    
    return [
        {
            "id": str(row[0]),
            "name": row[1],
            "total_seats": row[2]
        }
        for row in results
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)