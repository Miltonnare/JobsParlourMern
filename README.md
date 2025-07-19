# 💼 Jobs Parlour — MERN Stack Job Application Platform

Jobs Parlour is a real-world job marketplace MVP built with the **MERN stack (MongoDB, Express.js, React, Node.js)**. It allows **employers** to post jobs and manage applications, while **job seekers** can browse jobs and apply — all within a secure, role-based system.

---

## 📸 Screenshots

Coming soon... 

---

## 🚀 Features

### 👥 Authentication & Roles
- User Registration & Login with JWT
- Role-based access: `employer` vs `jobseeker`
- Protected dashboard routes

### 🧑‍💼 Employer Features
- Post, edit, and delete jobs
- View applicants per job
- Export applicants as **CSV**
- Manage dashboard

### 🔍 Job Seeker Features
- Browse all available jobs
- Apply to jobs (only once)
- Dashboard view of applied jobs 

### 💻 Tech Stack

| Layer      | Technology           |
|------------|----------------------|
| Frontend   | React, Tailwind CSS  |
| State/Auth | Context API, JWT     |
| Backend    | Express.js, Node.js  |
| Database   | MongoDB + Mongoose   |
| API Test   | Postman              |
| Deployment | Render (backend), Vercel (frontend) |

---

## 🏗️ Project Structure

```bash
jobs-parlour/
├── client/            # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/   # AuthContext
│       └── App.jsx
├── server/      # Express backen
|   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── server.js

```

🛡️ Security Notes

Passwords are hashed with bcrypt

JWT is used for authentication

Routes are protected based on roles

👨‍💻 Author
Milton

Built as part of a practical full-stack developer journey focused on real-world systems.



## Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [GitHub Classroom Guide](https://docs.github.com/en/education/manage-coursework-with-github-classroom) 
