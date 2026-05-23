# SynChef - Collaborative Real-Time Global Cooking Platform

![SynChef](https://img.shields.io/badge/Status-In%20Development-yellow)
![Stack](https://img.shields.io/badge/Stack-Full--Stack-blue)
![License](https://img.shields.io/badge/License-MIT-green)

SynChef is a revolutionary cooking application that transforms the home cooking experience with real-time execution, peer-to-peer collaboration, and global gastronomy exploration.

## 🌟 Key Features

### 1. **User Authentication & Account Management**
- Email/username registration with password validation
- Secure login with JWT token authentication
- Google OAuth social login integration
- Protected routes for authenticated users
- User profile and preferences

### 2. **Global 3D Flavor Map**
- Interactive 3D rotating globe with continent markers
- Explore cuisines by continent and country
- Click continents to filter and view countries
- Browse recipes from selected country
- Visual representation with country flags and descriptions
- Cultural context and history for each dish
- Traditional ingredients specific to each region

### 3. **Recipe Discovery & Browsing**
- Browse all recipes with intuitive categorization
- Filter recipes by meal type (Breakfast, Lunch, Dinner, Dessert, Appetizer, Beverage)
- Real-time recipe search with instant filtering
- Recipe cards with preparation time and difficulty level
- Click to view detailed recipe information

### 4. **Adaptive Parallel Timer System**
- Track multiple cooking tasks simultaneously
- Smart scheduling ensures everything finishes at the same time
- Visual countdown timers with notifications

### 5. **Dynamic Ingredient Scaling**
- Automatic recalculation of ingredients based on servings
- Smart rounding for common cooking measurements
- Real-time updates across all recipe components

### 6. **Progressive Step-by-Step UI (Focus Mode)**
- One instruction visible at a time
- Prevents information overload
- Smooth animations between steps

### 7. **AI-Powered Intelligence**
- Smart ingredient substitutions based on region and availability
- Culturally accurate alternatives
- Personalized cooking tips based on skill level
- Timing optimization suggestions

### 8. **Eye-Catching UI/UX**
- Modern gradient designs with glassmorphism
- Smooth animations with Framer Motion
- Intuitive navigation with three-button header (Home, Flavor Map, Login/Profile)
- Mobile-responsive design

## 🚀 Quick Start

### Backend
```bash
cd backend
cp .env.example .env.local
# Edit .env.local with your database credentials
mvn clean install
mvn spring-boot:run
# Backend runs on http://localhost:8080
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Google OAuth Client ID (optional)
npm run dev
# Frontend runs on http://localhost:5173
```

See detailed [Setup Instructions](#setup-instructions) below.

## 🏗️ System Architecture

### Backend (Spring Boot + PostgreSQL)
```
backend/
├── src/main/java/com/synchef/
│   ├── model/           # JPA entities (User, Recipe, Country, etc.)
│   ├── controller/      # REST API endpoints
│   ├── service/         # Business logic (AuthService, etc.)
│   ├── repository/      # Data access layer
│   ├── security/        # JWT token provider
│   └── dto/             # Data transfer objects
│   ├── service/         # Business logic
│   ├── controller/      # REST endpoints
│   ├── config/          # Configuration classes
│   └── dto/             # Data transfer objects
└── pom.xml              # Maven dependencies
```

### Frontend (React + TypeScript)
```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route pages
│   ├── store/           # Redux state management
│   ├── api/             # API client
│   └── types/           # TypeScript definitions
└── package.json         # NPM dependencies
```

## 🚀 Quick Start

### Prerequisites
- Java 17 or higher
- Node.js 18+ and npm
- PostgreSQL 14+
- Maven 3.8+
- Git

### Database Setup

1. **Install PostgreSQL** (if not already installed)

2. **Create Database**:
```sql
CREATE DATABASE synchef_db;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE synchef_db TO postgres;
```

3. **Configure Connection**: Update `backend/src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/synchef_db
spring.datasource.username=postgres
spring.datasource.password=YOUR_PASSWORD
```

### Backend Setup

1. **Navigate to backend directory**:
```bash
cd backend
```

2. **Build the project**:
```bash
mvn clean install
```

3. **Run the application**:
```bash
mvn spring-boot:run
```

The backend will start on `http://localhost:8080`

### Frontend Setup

1. **Navigate to frontend directory**:
```bash
cd frontend
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start development server**:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

### AI Configuration (Optional)

To enable AI features, add your OpenAI API key:

1. Create `.env` file in backend directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
```

2. Or update `application.properties`:
```properties
spring.ai.openai.api-key=your_openai_api_key_here
```

## 📡 API Endpoints

### Recipes
- `GET /api/recipes` - Get all recipes
- `GET /api/recipes/{id}` - Get recipe by ID
- `GET /api/recipes/country/{countryId}` - Get recipes by country
- `GET /api/recipes/{id}/scale?servings={n}` - Get scaled recipe
- `GET /api/recipes/{id}/timer-sequence` - Get optimized timer orchestration

### Countries
- `GET /api/countries` - Get all countries
- `GET /api/countries/continents` - Get countries grouped by continent
- `GET /api/countries/code/{code}` - Get country by code

### AI Features
- `POST /api/ai/substitutions` - Get ingredient substitutions
- `POST /api/ai/personalized-tips` - Get personalized cooking tips
- `GET /api/ai/cultural-context` - Get cultural background

### WebSocket
- `ws://localhost:8080/ws` - Real-time timer updates

## 🎯 SDG Alignment

This project aligns with multiple UN Sustainable Development Goals:

- **SDG 2 - Zero Hunger**: Promotes home cooking and diverse, nutritious recipes
- **SDG 3 - Good Health & Well-being**: Supports healthier meal preparation
- **SDG 4 - Quality Education**: Teaches global culinary techniques
- **SDG 8 - Decent Work & Economic Growth**: Features local producers
- **SDG 12 - Responsible Consumption**: Reduces food waste through precise scaling

## 🛠️ Technology Stack

### Backend
- **Spring Boot 3.2.2** - Application framework
- **Spring Data JPA** - Database access
- **PostgreSQL** - Relational database
- **Spring WebSocket** - Real-time communication
- **Spring AI** - AI integration
- **Lombok** - Code simplification

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Redux Toolkit** - State management
- **React Router** - Navigation
- **Framer Motion** - Animations
- **Three.js & React Three Fiber** - 3D globe
- **Axios** - HTTP client
- **Vite** - Build tool

## 📱 Features In Detail

### Parallel Timer System
The timer orchestration service analyzes all cooking steps and:
- Groups parallel tasks
- Calculates optimal start times
- Ensures synchronized completion
- Provides real-time updates via WebSocket

### Dynamic Scaling Algorithm
```java
scaledQuantity = originalQuantity × (requestedServings / defaultServings)
adjustedTime = baseTime × (scalingFactor ^ 0.3) // Logarithmic scaling
```

### AI Substitution Logic
The AI service:
1. Analyzes ingredient availability by region
2. Considers dietary restrictions and allergies
3. Maintains cultural authenticity
4. Provides practical alternatives

## 🧪 Testing

### Backend Tests
```bash
cd backend
mvn test
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
mvn clean package
java -jar target/synchef-backend-1.0.0.jar
```

### Frontend
```bash
cd frontend
npm run build
# Serve the dist/ directory
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- Your Name - Initial work

## 🙏 Acknowledgments

- Inspired by the need for better cooking apps
- Cultural recipes from communities worldwide
- Open-source libraries and frameworks

## 📞 Support

For support, email support@synchef.com or open an issue on GitHub.

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Voice-guided cooking
- [ ] Computer vision for doneness detection
- [ ] Social features (recipe sharing)
- [ ] Meal planning integration
- [ ] Grocery list generation
- [ ] Nutrition tracking

---

**Made with ❤️ for home cooks worldwide**
