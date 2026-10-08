# Sprint 2 Development Guidelines & Git Workflow

## 🎯 Overview
Welcome to **Sprint 2** of the **AI Real Estate (Haven)** project!

To maintain high code quality, prevent merge conflicts, keep our commit history clear, and ensure proper peer collaboration, **all team members must strictly follow the branching, commit message, and pull request workflow outlined below**.

---

## 📌 Core Rules for Everyone

1. **Feature / User Story Branches Only**
   - **Never commit or push directly to `main`**.
   - Every contributor must create a separate branch named after the specific feature or user story being worked on.
   - **Branch naming convention**:
     - `feature/<user-story-id>-<short-description>` or `feature/<feature-name>`
     - Examples:
       - `feature/US-07-interactive-map`
       - `feature/US-08-school-zone-filter`
       - `fix/US-02-mortgage-rounding`
       - `chore/update-dependencies`

2. **Meaningful Commit Messages Linked to User Stories**
   - Every commit message must be clear, descriptive, and explicitly relate to your user story or feature.
   - Explain *what* was done and *why* so teammates can follow the rationale in `git log`.
   - **Commit format**: `<type>(<user-story>): <clear action description>`
   - **Good examples**:
     - `feat(US-07): add interactive Leaflet map component with listing pins`
     - `feat(US-08): implement school zone filtering in specialist rail`
     - `fix(US-02): correct monthly payment formula for zero deposit edge case`
     - `test(US-07): add unit tests for map pin cluster clicks`
   - **Avoid poor/vague messages**:
     - ❌ `changes`
     - ❌ `fix stuff`
     - ❌ `wip`
     - ❌ `update code`

3. **Pull Requests (PRs) & Mandatory Peer Review**
   - Once your work is ready, push your branch and open a **Pull Request (PR)** against `main`.
   - **Every PR must be reviewed and approved by at least one other team member before merging.**
   - Do **not** self-merge without a review.
   - Code reviews ensure that acceptance criteria are met, potential bugs or regressions are caught early, and everyone stays informed of changes across the codebase.

---

## 🛠️ Step-by-Step Git Workflow

### 1. Sync Your Local `main`
Before starting any new work, make sure your local copy of `main` is completely up to date:
```bash
git checkout main
git pull origin main
```

### 2. Create Your Feature Branch
Create and switch to a new branch named after your feature or user story:
```bash
git checkout -b feature/US-XX-your-feature-name
```

### 3. Develop & Verify Locally
Write your code, keeping acceptance criteria in mind. Before committing, always run local verification:
```bash
# In ai-real-estate/:
npm test        # Verify all unit/integration tests pass
npm run lint    # Check for formatting or lint issues
npm run build   # Confirm TypeScript compiles and build succeeds
```

### 4. Stage and Commit with Proper Messages
Make focused, atomic commits that clearly describe the changes for your user story:
```bash
git add <files>
git commit -m "feat(US-XX): describe what you built and how it addresses the story"
```

### 5. Push Your Branch
Push your branch to the remote repository on GitHub:
```bash
git push -u origin feature/US-XX-your-feature-name
```

### 6. Open a Pull Request (PR)
1. Navigate to the GitHub repository.
2. Click **Compare & pull request** for your branch.
3. In the PR description, include:
   - **User Story**: Link to or name the user story being addressed.
   - **Description**: Summary of the changes implemented.
   - **Verification**: Evidence/notes confirming tests pass (`npm test`, `npm run lint`, manual UI checks).
   - **Screenshots / Recordings** *(optional but recommended for UI updates)*.
4. Assign at least one team member as a **Reviewer**.

### 7. Review & Address Feedback
- The reviewer will inspect the code, check acceptance criteria, and leave comments or approve.
- If revisions are requested, make the changes locally and push new commits to the same branch. The PR will automatically update.

### 8. Merge and Clean Up
- Once approved, merge the PR into `main` using **Squash and merge** or standard merge according to team preference.
- Delete the remote feature branch on GitHub and locally:
```bash
git checkout main
git pull origin main
git branch -d feature/US-XX-your-feature-name
```

---

## ✅ Pull Request Review Checklist
When reviewing a teammate's PR, please verify:
- [ ] **Branch Name**: Follows `feature/<user-story-name>` convention.
- [ ] **Commit Messages**: Clear, meaningful, and tied to the user story.
- [ ] **Requirements**: All acceptance criteria for the user story are met.
- [ ] **Quality & Tests**: `npm test` and `npm run lint` pass cleanly with no new errors or warnings.
- [ ] **Documentation**: Any new components, APIs, or config variables are documented where appropriate.
