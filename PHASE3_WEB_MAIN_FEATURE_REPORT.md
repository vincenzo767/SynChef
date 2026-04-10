# IT342 Phase 3 - Web Main Feature Completed

## Development Tasks

### 1. Main Feature Implementation
Develop the main feature of your application in the web system.

Requirements coverage:
- The feature matches the approved project proposal and SDD through the SynCook Community Recipe Sharing workflow.
- The feature is functional and connected to backend and database through authenticated SynCook API endpoints and PostgreSQL persistence.
- The feature allows users to perform the main system purpose by creating, sharing, and discussing cooking recipes.
- Proper validation and error handling are applied in frontend and backend.
- Appropriate success and error messages are displayed for key user actions.

Implemented behavior:
- Users can create SynCook recipes with dish name, country, ingredients, procedures, privacy, and image.
- Users can view public recipes and open full recipe details.
- Owners can edit and delete their uploaded recipes.
- Users can post comments and feedback on recipes.
- Search/filter is available by dish, country, or chef.

Validation and error handling applied:
- Frontend:
  - Dish name minimum 3 characters
  - Country minimum 2 characters
  - At least one ingredient and one procedure step required
  - Comment length: 2 to 500 characters
  - Uploaded image must be an image and 5MB or less
  - Image URL validity check when manually provided
- Backend:
  - Title and country required
  - At least one ingredient and one procedure required
  - Comment required
  - Owner-only update/delete enforcement
  - Private recipe access restricted to owner
- User feedback:
  - Success messages for create, update, delete, comment post, and valid image load
  - Error messages for validation and API failures
  - Empty-state message when no recipes match a search

### 2. Web Integration
- The web frontend is connected to backend API through SynCook client calls.
- Data is saved and retrieved correctly using backend controller and repository flow.
- Working frontend-backend-database interaction is shown in the following cycle:
  - Frontend form submission sends request to backend API
  - Backend validates request and writes to PostgreSQL tables
  - Frontend reloads API data and reflects updates in UI
  - Comments and recipe changes are persisted and displayed in subsequent reads

Used SynCook API endpoints:
- GET /api/syncook/public
- GET /api/syncook/mine
- GET /api/syncook/{id}
- POST /api/syncook
- PUT /api/syncook/{id}
- DELETE /api/syncook/{id}
- GET /api/syncook/{id}/comments
- POST /api/syncook/{id}/comments

Database tables involved:
- syncook_recipes
- syncook_recipe_ingredients
- syncook_recipe_procedures
- syncook_comments
- users

### 3. Short Summary
Description of the main feature:
- SynCook Community Recipe Sharing is the main web feature where authenticated users publish, manage, and discuss local dishes.

Inputs and validations used:
- Inputs include dish title, country, ingredients, procedures, privacy, image, and comments.
- Validations include required fields, minimum text lengths, image format/size checks, URL validation, and ownership/privacy access controls.

How the feature works:
- User opens dashboard, loads SynCook feed, creates/updates/deletes recipes, opens details, and posts comments.
- Backend processes requests and persists records in PostgreSQL.
- UI refreshes data from API so users see real-time state after each operation.

API endpoints used:
- GET /api/syncook/public
- GET /api/syncook/mine
- GET /api/syncook/{id}
- POST /api/syncook
- PUT /api/syncook/{id}
- DELETE /api/syncook/{id}
- GET /api/syncook/{id}/comments
- POST /api/syncook/{id}/comments

Database table/s involved:
- syncook_recipes
- syncook_recipe_ingredients
- syncook_recipe_procedures
- syncook_comments
- users
