# Better Auth Integration Boilerplate

Welcome to **Better Auth Integration Boilerplate**, a starter template designed to help you quickly set up secure and modern authentication for your applications. This project is built primarily with **TypeScript** and **JavaScript**, making it easy to extend and adapt for your specific needs.

## Table of Contents

- [About](#about)
- [Features](#features)
- [Getting Started](#getting-started)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Integrations](#integrations)
- [Contributing](#contributing)
- [License](#license)

---

## About

This boilerplate serves as a quick-start template for integrating authentication into your applications. It provides a well-structured codebase with best practices for authentication, email handling, and database management, making it easier to focus on building your core application features.

## Features

- **Pre-configured Authentication**: Includes basic user authentication, API key authentication, magic link authentication, and an admin addon for managing permissions and bans.
- **Email Sending**: Integrated with the Resend SDK for handling email communication (e.g., email verification and magic links).
- **Database ORM**: Uses Prisma for database operations with a ready-to-use schema for users, sessions, accounts, and API keys.
- **TypeScript-first**: Ensures type safety and better developer experience.
- **Customizable**: Easily extend and modify the boilerplate to suit your needs.
- **Secure**: Implements best practices for secure authentication.

## Getting Started

Follow the steps below to get started with this boilerplate.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/withviktor/better-auth-integration.git
   cd better-auth-integration
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

## Configuration

This boilerplate includes configuration options to suit various use cases. Update the following files to set up your authentication, email, and database:

- **Authentication**: Modify `src/utils/auth.ts` to configure BetterAuth (e.g., enable plugins like API keys, magic links, and OpenAPI).
- **Email Sending**: Update `src/utils/resend.ts` with your Resend API key.
- **Database**: Check `prisma/schema.prisma` to configure your database schema and connection.

## Usage

After configuring the boilerplate, you can start building your application.

### Example

Here’s how to use the boilerplate to set up authentication:

```typescript
import { auth } from './utils/auth';

// Use the `auth` object in your application
app.use(auth.middleware);
```

## Integrations

This boilerplate includes the following key integrations:

### Authentication with BetterAuth

The `auth.ts` file pre-configures **BetterAuth** with the following features:

- **Basic User Authentication**: Email and password-based authentication with email verification.
- **API Key Authentication**: Pre-configured API key plugin for managing API access.
- **Magic Link Authentication**: Enables users to log in via email magic links.
- **Admin Addon**: Includes functionality for managing permissions and bans.
- **OpenAPI Plugin**: Generates OpenAPI documentation for authentication endpoints.

[View `auth.ts` source code](https://github.com/withviktor/better-auth-integration/blob/main/src/utils/auth.ts)

### Email Sending with Resend SDK

The `resend.ts` file integrates **Resend**, allowing you to send emails for:

- Email verification
- Magic link authentication

[View `resend.ts` source code](https://github.com/withviktor/better-auth-integration/blob/main/src/utils/resend.ts)

### Database ORM with Prisma

This boilerplate uses **Prisma** to manage database operations. It includes:

- A pre-configured `PrismaClient` for database queries.
- A detailed schema (`schema.prisma`) for managing users, sessions, accounts, and API keys.

[View Prisma schema](https://github.com/withviktor/better-auth-integration/blob/main/prisma/schema.prisma)

## Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository.
2. Create a new branch (`feature/your-feature-name`).
3. Commit your changes with clear and descriptive messages.
4. Push your branch and create a Pull Request.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md) and ensure your contributions align with the project's goals.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

We hope this boilerplate accelerates your development and helps you create better authentication experiences. If you have any questions or suggestions, feel free to open an issue or contribute directly!

Happy coding! 🚀
