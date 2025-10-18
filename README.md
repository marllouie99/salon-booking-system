# Salon Booking System

A comprehensive salon booking system built with Node.js frontend and Django backend.

## 🚀 Features

- **User Authentication**: Login and registration for customers and salon owners
- **Responsive Design**: Beautiful, modern UI that works on all devices
- **Dual Architecture**: Node.js frontend with Django REST API backend
- **MySQL Database**: Reliable data storage and management
- **Real-time Updates**: Instant booking confirmations and updates

## 📁 Project Structure

```
salon-booking-system/
├── frontend/          # Node.js frontend application
│   ├── public/       # Static files (HTML, CSS, JS)
│   ├── package.json  # Frontend dependencies
│   └── server.js     # Express server
├── backend/          # Django backend application
│   ├── salon_booking/  # Main Django project
│   ├── accounts/      # User authentication app
│   ├── salons/        # Salon management app
│   ├── bookings/      # Booking system app
│   └── requirements.txt  # Backend dependencies
└── database/         # Database configuration and scripts
```

## 🛠️ Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- MySQL (v8.0 or higher)

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend server:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your database configuration:
   ```env
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   DB_NAME=salon_booking
   DB_USER=root
   DB_PASSWORD=your-password
   DB_HOST=localhost
   DB_PORT=3306
   ```

5. Run migrations:
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

6. Create a superuser:
   ```bash
   python manage.py createsuperuser
   ```

7. Start the backend server:
   ```bash
   python manage.py runserver
   ```

The backend API will be available at `http://localhost:8000`

### Database Setup

1. Create a MySQL database:
   ```sql
   CREATE DATABASE salon_booking;
   ```

2. Update your `.env` file with the correct database credentials.

## 🎨 UI Features

- **Modern Design**: Clean, professional interface with gradient backgrounds
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile
- **Interactive Modals**: Smooth login and registration forms
- **Form Validation**: Real-time validation with user-friendly error messages
- **Password Strength**: Visual password strength indicator
- **Notifications**: Toast notifications for user feedback

## 🔧 API Endpoints

- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `POST /api/auth/logout/` - User logout
- `GET /api/salons/` - List salons
- `POST /api/bookings/` - Create booking

## 🚀 Next Steps

1. Set up the database and run migrations
2. Implement salon management features
3. Add booking functionality
4. Integrate payment processing
5. Add email notifications
6. Implement admin dashboard

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
