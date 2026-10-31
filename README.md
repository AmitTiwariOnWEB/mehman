# Mehman – Visitor Management System

**Mehman** is a digital Visitor Management System designed to simplify and secure visitor registration and access management for residential societies, apartments, offices, and organizations.

It provides a centralized platform through a web-based CRM and a mobile application, allowing administrators, receptionists, and security personnel to manage visitor activities efficiently.

## Key Features

- **Visitor Registration:** Register and manage visitor details digitally.
- **QR Code Gatepass:** Generate unique QR-code-based gatepasses for visitors.
- **QR Code Scanning:** Verify visitor gatepasses using the mobile application.
- **Entry and Exit Tracking:** Maintain records of visitor entry and exit activities.
- **User Management:** Manage administrators, security guards, residents, and other authorized users.
- **Branch and Society Management:** Manage multiple branches and residential communities.
- **Dashboard and Analytics:** View visitor records and activity summaries.
- **Notifications:** Keep relevant users informed about visitor activities.

## Applications

- **Web CRM:** A centralized dashboard for managing visitors, gatepasses, users, and operations.
- **Mobile Application:** Enables mobile access to visitor management and QR-code verification.

## Technology Stack

| Component | Technology |
|---|---|
| Web Frontend | React.js, Vite |
| Mobile Application | React Native, Expo |
| Backend | Node.js, Express.js |
| Database | MySQL |
| ORM | Prisma |
| Authentication | JWT, bcryptjs |
| Validation | Zod |
| QR Code Generation | qrcode |
| State Management | Zustand |

## System Architecture

The web CRM and mobile application communicate with a common backend through REST APIs. The backend handles business logic, authentication, visitor management, QR-code verification, and database operations using MySQL.

## Project Objective

The main objective of Mehman is to replace manual visitor registers and traditional gatepass processes with a centralized digital system that improves security, simplifies visitor management, and maintains accurate entry and exit records.