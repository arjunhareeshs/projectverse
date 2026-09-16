import { z } from 'zod';
import type { CapstoneRepoSummary } from './capstone.githubAnalysis';

export interface GeneratedMcqQuestion {
  question: string;
  options: string[];
  correctOption: number;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | string;
  explanation?: string;
}

export const McqQuestionSchema = z.object({
  question: z.string().min(10),
  options: z.array(z.string()).min(6).max(6),
  correctOption: z.number().int().min(0).max(5),
  topic: z.string().optional().default('Implementation'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  explanation: z.string().optional().default(''),
});

export const McqPayloadSchema = z.object({
  questions: z.array(McqQuestionSchema).min(1),
});

export const MCQ_SYSTEM_PROMPT = `You are an expert project evaluator for a capstone assessment.

Your task is to generate exactly 15 multiple-choice questions from the submitted student project.

The questions must evaluate whether the student deeply understands:
- the project problem statement
- the implemented features
- the code structure
- the selected framework
- the architecture
- database/schema choices
- API flow
- frontend/backend interaction
- authentication/state management if present
- important files and functions
- trade-offs and limitations

Rules:
1. Generate exactly 15 MCQs.
2. Each MCQ must have exactly 6 options.
3. Only one option must be correct.
4. Do not make the correct answer obvious.
5. Do not always make the longest option correct.
6. Correct options must be distributed randomly across option indexes 0 to 5.
7. Avoid generic theory questions unless directly connected to the submitted code.
8. Questions must be project-specific and framework-specific.
9. Include at least:
   - 3 code-structure questions
   - 3 framework/core-concept questions
   - 3 implementation-flow questions
   - 2 database/API questions if applicable
   - 2 debugging/edge-case questions
   - 2 project-depth/design-decision questions
10. Return only valid JSON.

JSON format:
{
  "questions": [
    {
      "question": "string",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E", "Option F"],
      "correctOption": 0,
      "topic": "string",
      "difficulty": "easy|medium|hard",
      "explanation": "string"
    }
  ]
}`;

export function buildMcqUserPrompt(
  problemStatement: string,
  repoSummary: CapstoneRepoSummary,
  targetCount = 15
): string {
  const inspectedFilesText = repoSummary.inspectedFiles
    .map(
      (f) => `--- File: ${f.path} ---\n${f.snippet.slice(0, 1500)}`
    )
    .join('\n\n');

  return `Capstone Problem Statement:
${problemStatement}

Submitted Repository Summary:
- Repository: ${repoSummary.owner}/${repoSummary.repo} (Branch: ${repoSummary.defaultBranch})
- Framework Detected: ${repoSummary.framework}
- Architecture: ${repoSummary.architecture}
- Database Usage: ${repoSummary.databaseUsage}
- Authentication: ${repoSummary.authUsage}
- Major Modules: ${repoSummary.majorModules.join(', ') || 'Root'}
- API Routes Identified: ${repoSummary.apiRoutes.join(', ') || 'Standard routes'}
- Frontend Components Identified: ${repoSummary.frontendComponents.join(', ') || 'Custom UI'}
- Testing Presence: ${repoSummary.testingPresence}
- Implementation Scope: ${repoSummary.projectCompleteness} (${repoSummary.totalFilesCount} files)

Source Code Excerpts from Submitted Repository:
${inspectedFilesText || 'No source files directly inspected.'}

Generate exactly ${targetCount} deep technical questions testing the student's mastery and authentic authorship of this specific codebase.`;
}

/**
 * Fallback generator in case the LLM provider is degraded or unconfigured.
 * Generates authentic, framework-aware, 6-option MCQs according to targetCount.
 */
export function generateFallbackMcqs(
  problemStatement: string,
  repoSummary: CapstoneRepoSummary,
  targetCount = 15
): GeneratedMcqQuestion[] {
  const fw = repoSummary.framework || 'Web Application';
  const db = repoSummary.databaseUsage || 'Data Storage';
  const arch = repoSummary.architecture || 'Client-Server';
  const repo = repoSummary.repo;

  const templates: Omit<GeneratedMcqQuestion, 'correctOption'>[] = [
    {
      question: `In this repository (${repo}), what is the primary role of the top-level architectural layout (${arch})?`,
      options: [
        `Decouples business logic and user interface layers for independent maintainability and scalability`,
        `Merges all database drivers and UI components into a single uncompiled script`,
        `Forces all network calls to bypass API gateway validations`,
        `Restricts code execution strictly to client-side WebAssembly modules`,
        `Disables server-side routing in favor of static file servers`,
        `Prevents asynchronous promise handling across modules`,
      ],
      topic: 'Code Structure',
      difficulty: 'medium',
      explanation: 'Decoupling separates responsibilities, making features testable and maintainable.',
    },
    {
      question: `Which core framework pattern is utilized in this project based on ${fw}?`,
      options: [
        `Component-driven reactivity or structured request-response routing tailored to ${fw}`,
        `Imperative manual DOM mutation without any state container`,
        `Raw assembly socket programming for HTTP requests`,
        `Kernel-level driver abstraction for user events`,
        `Monolithic desktop window event loops`,
        `Batch cron processing exclusively without user interface`,
      ],
      topic: 'Framework Core Concepts',
      difficulty: 'medium',
      explanation: `${fw} relies on structured routing and component-driven abstractions.`,
    },
    {
      question: `How is data persistence handled in this project according to ${db}?`,
      options: [
        `Using structured schema models and ORM/driver abstractions for query execution and integrity`,
        `Writing all records to temporary OS process memory without permanent disk storage`,
        `Serializing state as plain text cookies in client browser headers`,
        `Relying on external CSV files committed directly to the git branch on each request`,
        `Executing arbitrary unescaped client SQL strings directly over web sockets`,
        `Storing objects in local localStorage exclusively with no backend layer`,
      ],
      topic: 'Database & Schema',
      difficulty: 'hard',
      explanation: 'Structured schema models provide validation, type safety, and relational constraints.',
    },
    {
      question: `In the context of the capstone problem statement, how does the API layer route requests to business services?`,
      options: [
        `Controllers intercept incoming HTTP requests, validate input parameters, and invoke service modules`,
        `Incoming requests execute database migrations before each query response`,
        `Every API endpoint sends raw HTML templates directly without data payloads`,
        `Clients execute direct filesystem reads on the server without going through route handlers`,
        `HTTP GET requests are converted into FTP file uploads before dispatching`,
        `All route endpoints share a single synchronous global variable without request isolation`,
      ],
      topic: 'API Flow',
      difficulty: 'medium',
      explanation: 'Controller layers separate request decoding and validation from business domain services.',
    },
    {
      question: `What mechanism does this project use to ensure authentication and secure session state (${repoSummary.authUsage})?`,
      options: [
        `Validating cryptographically signed tokens or session hashes with protected route guards`,
        `Storing plain passwords in client localStorage and comparing them in frontend logic`,
        `Transmitting unhashed user credentials in URL query parameters on every request`,
        `Allowing public unrestricted access to all API endpoints without identity verification`,
        `Relying on IP address matching without user authentication headers`,
        `Using hardcoded single-tenant administrator credentials in client source code`,
      ],
      topic: 'Authentication & Security',
      difficulty: 'hard',
      explanation: 'Tokens/sessions signed with cryptographic secrets prevent unauthorized impersonation.',
    },
    {
      question: `When handling asynchronous operations or network requests in ${fw}, how are unexpected runtime exceptions caught?`,
      options: [
        `Through try-catch blocks or centralized global error-handling middleware returning standard HTTP status codes`,
        `By silently suppressing errors and halting the runtime thread entirely`,
        `By redirecting all runtime exceptions directly to the operating system crash reporter`,
        `By refreshing the user browser page on every background task failure`,
        `By resetting the database schema whenever a query fails`,
        `By terminating the node/python process on any validation error`,
      ],
      topic: 'Debugging & Edge Cases',
      difficulty: 'medium',
      explanation: 'Centralized error middleware translates exceptions into predictable, safe HTTP status responses.',
    },
    {
      question: `How are frontend UI components structured to interact with backend endpoints in this codebase?`,
      options: [
        `Components trigger asynchronous HTTP/fetch requests and bind returned JSON data to local state`,
        `UI components write binary bytecode directly into server socket memory`,
        `Frontend code executes SQL insert statements directly inside JSX/HTML markup`,
        `Every button click reloads the entire application from the root HTML page`,
        `Components communicate with backend services exclusively using UDP datagrams`,
        `The frontend does not render any interactive controls or forms`,
      ],
      topic: 'Frontend/Backend Interaction',
      difficulty: 'medium',
      explanation: 'Modern SPA/SSR components maintain reactive state populated via structured asynchronous requests.',
    },
    {
      question: `What trade-off is introduced by the chosen modular directory structure (${repoSummary.majorModules.join(', ') || 'root'})?`,
      options: [
        `Increases file organization and separation of concerns at the cost of requiring clear module import boundaries`,
        `Guarantees 100% test coverage without writing any unit test suites`,
        `Eliminates the need for build tools, package managers, and compilation`,
        `Completely prevents the application from being deployed to cloud container environments`,
        `Forces all source files to be compiled into a single massive index file during development`,
        `Limits the codebase to running on a single operating system thread permanently`,
      ],
      topic: 'Project Depth & Design Decisions',
      difficulty: 'hard',
      explanation: 'Modular boundaries improve team collaboration and code reuse while requiring explicit import paths.',
    },
    {
      question: `How does the repository verify code correctness and avoid regressions (${repoSummary.testingPresence})?`,
      options: [
        `Through automated assertions or test runner configs verifying critical functions and endpoints`,
        `By relying solely on end-user complaints in production environments`,
        `By disabling all type-checking and linter validations during build steps`,
        `By recompiling third-party library source code on every git push`,
        `By executing benchmark scripts that overwrite application data`,
        `By running continuous database drop-and-reseed commands in production`,
      ],
      topic: 'Code Structure & Testing',
      difficulty: 'easy',
      explanation: 'Automated test runners execute assertions against critical logic to prevent regressions.',
    },
    {
      question: `In ${repoSummary.framework}, what is the recommended lifecycle for managing side effects or data fetching?`,
      options: [
        `Triggering side effects inside lifecycle hooks or asynchronous controller functions after mounting/request reception`,
        `Invoking side effects inside pure render functions or constructor declarations directly`,
        `Calling external third-party APIs synchronously inside style CSS definitions`,
        `Halting the event loop until network responses return from background servers`,
        `Executing database seeds inside UI component rendering passes`,
        `Relying on OS-level cron intervals to poll for component state updates`,
      ],
      topic: 'Framework Core Concepts',
      difficulty: 'medium',
      explanation: 'Side effects must be isolated in lifecycle hooks or middleware to prevent infinite render loops.',
    },
    {
      question: `How does this application handle state consistency across multiple concurrent user actions?`,
      options: [
        `Via transactional database queries, atomic operations, or centralized state stores`,
        `By locking the client browser window whenever an asynchronous call is running`,
        `By ignoring concurrent modifications and letting the slowest request overwrite changes arbitrarily`,
        `By restarting the server on every simultaneous HTTP connection`,
        `By storing shared data in temporary browser sessionStorage across all users`,
        `By queuing all application users into a single sequential FIFO queue`,
      ],
      topic: 'Implementation Flow',
      difficulty: 'hard',
      explanation: 'Database transactions and atomic operators ensure state transitions satisfy ACID guarantees.',
    },
    {
      question: `What security practice is critical when receiving input payloads in the API endpoints of ${repo}?`,
      options: [
        `Strict input validation and schema sanitization before processing database or business logic`,
        `Trusting all client request bodies without schema verification`,
        `Injecting raw strings directly into database query builders`,
        `Echoing back received authentication secrets in public error messages`,
        `Disabling CORS protection and authorization headers globally`,
        `Bypassing password hashing algorithms to reduce server latency`,
      ],
      topic: 'Debugging & Edge Cases',
      difficulty: 'easy',
      explanation: 'Validating and sanitizing inputs protects against SQL injection, XSS, and malformed payload crashes.',
    },
    {
      question: `Which configuration file in this repository governs project dependencies and compilation targets?`,
      options: [
        `Package manifest (e.g. package.json, requirements.txt, or pom.xml) and compiler configurations`,
        `The operating system bash profile file located in the user home directory`,
        `The browser history cache manifest`,
        `The Git commit history log index`,
        `Temporary swap files generated during IDE execution`,
        `The web server access log file`,
      ],
      topic: 'Code Structure',
      difficulty: 'easy',
      explanation: 'Manifest and compiler config files declare runtime packages, build scripts, and engine compatibility.',
    },
    {
      question: `How does the implementation fulfill the core objective of: "${problemStatement.slice(0, 100)}..."?`,
      options: [
        `By implementing dedicated domain entities, business workflows, and interactive interfaces addressing the problem statement`,
        `By using a placeholder README without actual domain logic or endpoints`,
        `By hardcoding static mock JSON strings in place of real calculation logic`,
        `By redirecting all requests to an external search engine`,
        `By implementing an unrelated sample starter application without domain customization`,
        `By deleting previous project iterations to reduce deployment size`,
      ],
      topic: 'Project Depth & Design Decisions',
      difficulty: 'medium',
      explanation: 'Authentic capstone solutions map domain requirements directly into concrete business algorithms.',
    },
    {
      question: `If this capstone project were scaled to handle 10,000 active concurrent users, what would be the most immediate architectural bottleneck?`,
      options: [
        `Database connection pooling, unindexed query execution, and compute capacity on the primary API server`,
        `The size of static markdown documentation files in the git repository`,
        `The number of branches created in the remote GitHub repository`,
        `The character length of variable names in source code files`,
        `The version of the git version control software installed locally`,
        `The physical screen resolution of the client display monitor`,
      ],
      topic: 'Project Depth & Design Decisions',
      difficulty: 'hard',
      explanation: 'Under high concurrent loads, connection pool limits and slow database queries saturate server workers first.',
    },
  ];

  // Distribute correctOption randomly between 0 and 5
  const formatted = templates.map((t, idx) => {
    const targetCorrect = idx % 6; // guarantees uniform 0-5 distribution
    const options = [...t.options];
    if (targetCorrect !== 0) {
      // swap index 0 with targetCorrect
      const temp = options[0];
      options[0] = options[targetCorrect];
      options[targetCorrect] = temp;
    }
    return {
      question: t.question,
      options,
      correctOption: targetCorrect,
      topic: t.topic,
      difficulty: t.difficulty,
      explanation: t.explanation,
    };
  });

  const count = Math.max(1, targetCount);
  if (formatted.length >= count) {
    return formatted.slice(0, count);
  }

  // If targetCount is greater than the base 15 templates, repeat with slight variations
  const result: GeneratedMcqQuestion[] = [...formatted];
  let cycle = 1;
  while (result.length < count) {
    const base = formatted[(result.length - formatted.length) % formatted.length];
    result.push({
      ...base,
      question: `[Section ${cycle + 1}] ${base.question}`,
      correctOption: (base.correctOption + cycle) % 6,
    });
    cycle++;
  }
  return result;
}
