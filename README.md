# Split & Settle 💸

> A full-stack expense splitting application that calculates
> the minimum number of transactions to settle group debts.

## 🚀 Features

- JWT-based authentication (register & login)
- Create groups and invite members by email
- Add shared expenses with automatic equal splitting
- Debt simplification algorithm to minimize settlements
- RESTful API with Swagger documentation

## 🛠️ Tech Stack

| Layer    | Technology                          |
| -------- | ----------------------------------- |
| Frontend | Angular, PrimeNG, TypeScript        |
| Backend  | Spring Boot 3, Spring Security, JWT |
| Database | MySQL 8                             |
| Build    | Maven, npm                          |

## 📁 Project Structure

split-settle/
├── api/ # Spring Boot backend
├── split-settle/ # Angular frontend

## ⚙️ Backend Setup

### Prerequisites

- Java 17+
- MySQL 8+
- Maven 3.8+

### Steps

```bash
# Create database
mysql -u root -p
CREATE DATABASE splitsettle;

# Run the backend
cd api
mvn clean install
mvn spring-boot:run
# API runs at http://localhost:8080
# Swagger UI at http://localhost:8080/swagger-ui.html
```

## 💻 Frontend Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Steps

```bash
cd split-settle
npm install
ng serve
# Runs at http://localhost:4200
```

## 📡 API Endpoints

| Method | Endpoint                   | Description     | Auth |
| ------ | -------------------------- | --------------- | ---- |
| POST   | /api/auth/register         | Register user   | No   |
| POST   | /api/auth/login            | Login           | No   |
| GET    | /api/groups                | Get my groups   | Yes  |
| POST   | /api/groups                | Create group    | Yes  |
| POST   | /api/groups/{id}/members   | Add member      | Yes  |
| POST   | /api/expenses              | Add expense     | Yes  |
| GET    | /api/expenses/group/{id}   | List expenses   | Yes  |
| GET    | /api/settlements/{groupId} | Get settlements | Yes  |
| POST   | /api/settlements/settle    | Settle up       | Yes  |

## 🧮 Debt Simplification Algorithm

Instead of tracking every individual debt, the app
calculates each user's net balance (paid - owed),
then uses a greedy algorithm to match the largest
debtor with the largest creditor — minimizing total
transactions needed to settle a group.

## 🔒 Security

- Passwords hashed with BCrypt
- Stateless JWT authentication
- CORS configured for local frontend dev

## 📸 Screenshots

_(Coming soon — frontend in progress)_

---

Built by [Dinesh Ravi](https://github.com/dineshravi12)
