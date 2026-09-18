import type { Explanation } from '../types/explanation'
import type { LanguageId } from '../types/workspace'

/**
 * A catalog entry is an Explanation minus the request-specific fields
 * (those are filled in when the entry is resolved for a selection).
 */
export interface MockExplanationEntry
  extends Omit<Explanation, 'id' | 'selectedCode' | 'language'> {
  /** Normalized strings that should resolve to this entry. */
  match: string[]
  /** Restrict the entry to certain languages. Omit for "any language". */
  languages?: LanguageId[]
}

const JS_LIKE: LanguageId[] = ['javascript', 'typescript']

export const MOCK_EXPLANATIONS: MockExplanationEntry[] = [
  // ───────────────────────── JavaScript / TypeScript ─────────────────────────
  {
    match: ['const'],
    languages: JS_LIKE,
    concept: 'Declaration keyword',
    kind: 'keyword',
    simpleExplanation:
      'It creates a variable name whose binding cannot later be changed to point to another value.',
    definition:
      'A JavaScript declaration keyword used to create a lexical binding that cannot be reassigned.',
    contextualExplanation:
      'Here "const" introduces a new name and locks it to the value on the right side of the "=". The name can be read later in the function, but the code can never write "response = somethingElse" afterwards.',
    whyItExists:
      'The value only needs to be set once. Using "const" makes that intent explicit and lets the engine (and other readers) catch accidental reassignments.',
    relatedConcepts: [
      { label: 'let', hint: 'A variable that can be reassigned' },
      { label: 'variable', hint: 'A named container for a value' },
      { label: 'block scope', hint: 'Where a name is visible' },
      { label: 'immutability', hint: 'Values that do not change' },
    ],
  },
  {
    match: ['let'],
    languages: JS_LIKE,
    concept: 'Declaration keyword',
    kind: 'keyword',
    simpleExplanation:
      'It creates a variable that you are allowed to change later.',
    definition:
      'A JavaScript declaration keyword that creates a block-scoped, reassignable lexical binding.',
    contextualExplanation:
      '"let" introduces a name that the rest of this block can read and update. Unlike "const", a later line may assign a new value to it.',
    whyItExists:
      'Some values genuinely change over time, such as a counter or a running total. "let" signals that this one is expected to.',
    relatedConcepts: [
      { label: 'const', hint: 'A binding that cannot be reassigned' },
      { label: 'variable' },
      { label: 'block scope' },
    ],
  },
  {
    match: ['variable'],
    concept: 'Concept',
    kind: 'identifier',
    simpleExplanation:
      'A variable is a name that refers to a value so you can reuse it later without repeating the value.',
    definition:
      'A named storage location whose associated value can be read, and in most cases updated, during program execution.',
    contextualExplanation:
      'Names like "response" and "data" are variables. They let each line hand its result to the next line by name.',
    whyItExists:
      'Without variables every step would have to be written inline, and intermediate results could not be reused.',
    relatedConcepts: [{ label: 'const' }, { label: 'let' }, { label: 'block scope' }],
  },
  {
    match: ['block scope', 'scope'],
    concept: 'Concept',
    kind: 'keyword',
    simpleExplanation:
      'Scope is the region of code where a name is visible. Block scope means a name only exists inside the nearest pair of curly braces.',
    definition:
      'The lexical region in which a binding is accessible. Bindings declared with "let" and "const" are visible only within the enclosing block.',
    contextualExplanation:
      'The variables declared inside the function body are visible to every line in that body, but not to code outside the braces.',
    whyItExists:
      'Limiting where a name is visible prevents unrelated parts of a program from accidentally interfering with each other.',
    relatedConcepts: [{ label: 'const' }, { label: 'let' }, { label: 'function' }],
  },
  {
    match: ['immutability', 'immutable'],
    concept: 'Concept',
    kind: 'keyword',
    simpleExplanation:
      'Something immutable cannot be changed after it is created.',
    definition:
      'The property of a value or binding that prevents modification after initialization.',
    contextualExplanation:
      'Note that "const" makes the binding immutable, not the value: an object stored in a "const" can still have its properties changed.',
    whyItExists:
      'Code that never mutates shared values is easier to reason about, because a value means the same thing everywhere it appears.',
    relatedConcepts: [{ label: 'const' }, { label: 'variable' }],
  },
  {
    match: ['await'],
    languages: JS_LIKE,
    concept: 'Operator',
    kind: 'operator',
    simpleExplanation:
      'It tells the program to wait for an asynchronous operation to finish before continuing.',
    definition:
      'An operator used within an async function to suspend evaluation until a Promise settles and then produce its fulfillment value or throw its rejection reason.',
    contextualExplanation:
      'The expression to the right of "await" returns a Promise, a placeholder for a value that is not ready yet. "await" pauses this function at that line, lets the rest of the page keep running, and resumes with the real value once it arrives.',
    whyItExists:
      'Talking to a server takes time. Without "await" the next line would run immediately and try to use a response that has not arrived.',
    relatedConcepts: [
      { label: 'async', hint: 'Marks a function that can use await' },
      { label: 'Promise', hint: 'A value that will exist later' },
      { label: 'asynchronous', hint: 'Work that finishes later' },
      { label: 'fetch()' },
    ],
  },
  {
    match: ['async'],
    languages: JS_LIKE,
    concept: 'Function modifier',
    kind: 'keyword',
    simpleExplanation:
      'It marks a function as one that can pause and wait for slow operations using "await".',
    definition:
      'A keyword that declares an asynchronous function, which always returns a Promise and permits the use of the await operator in its body.',
    contextualExplanation:
      'Because this function is marked "async", the "await" lines inside it are allowed. Whoever calls the function gets back a Promise that resolves with its return value.',
    whyItExists:
      'The function needs to wait on a network request, and only async functions are allowed to "await".',
    relatedConcepts: [{ label: 'await' }, { label: 'Promise' }, { label: 'function' }],
  },
  {
    match: ['asynchronous', 'async / await', 'async/await'],
    concept: 'Concept',
    kind: 'keyword',
    simpleExplanation:
      'Asynchronous work starts now but finishes later, so the program can do other things in the meantime.',
    definition:
      'A model of execution in which an operation is initiated and its completion is handled at a later point, without blocking the calling thread.',
    contextualExplanation:
      'Fetching from the server is asynchronous. The "async" and "await" keywords let the code read top-to-bottom while still waiting correctly.',
    whyItExists:
      'A web page that froze every time it waited on a network request would feel broken. Asynchronous code keeps the interface responsive.',
    relatedConcepts: [{ label: 'async' }, { label: 'await' }, { label: 'Promise' }],
  },
  {
    match: ['promise'],
    concept: 'Built-in object',
    kind: 'type',
    simpleExplanation:
      'A Promise is a placeholder for a value that is not available yet but will be, or will fail.',
    definition:
      'An object representing the eventual completion or failure of an asynchronous operation and its resulting value.',
    contextualExplanation:
      'Both "fetch()" and "response.json()" return Promises. The "await" keyword unwraps each one so the code can work with the actual value.',
    whyItExists:
      'Promises give asynchronous operations a consistent shape, so any slow task can be waited on the same way.',
    relatedConcepts: [{ label: 'await' }, { label: 'async' }, { label: 'asynchronous' }],
  },
  {
    match: ['fetch()', 'fetch'],
    languages: JS_LIKE,
    concept: 'Web API function',
    kind: 'call',
    simpleExplanation: 'It lets your program request information from a server.',
    definition:
      'A Web API function used to initiate an HTTP request and return a Promise resolving to a Response object.',
    contextualExplanation:
      '"fetch()" is given the address "/api/users". The browser sends an HTTP request to that address and, once the server answers, hands back a Response object describing what came back.',
    whyItExists:
      'The user list lives on a server, not in the page. "fetch()" is the standard browser tool for asking a server for data.',
    relatedConcepts: [
      { label: 'HTTP request', hint: 'A message sent to a server' },
      { label: 'HTTP response', hint: 'The server’s answer' },
      { label: 'Promise' },
      { label: 'await' },
      { label: 'URL' },
    ],
  },
  {
    match: ['fetch("/api/users")', "fetch('/api/users')"],
    languages: JS_LIKE,
    concept: 'Function call',
    kind: 'call',
    simpleExplanation:
      'This asks the server for the data that lives at the "/api/users" address.',
    definition:
      'An invocation of the fetch Web API with a single string argument specifying the request URL, using the default GET method.',
    contextualExplanation:
      'The call sends a GET request to "/api/users" on the same site the page came from. It immediately returns a Promise, which is why the line in front of it uses "await".',
    whyItExists:
      'The program needs the list of users, and the server exposes it at this address.',
    relatedConcepts: [{ label: 'fetch()' }, { label: '/api/users' }, { label: 'HTTP request' }],
  },
  {
    match: ['/api/users', '"/api/users"', "'/api/users'"],
    languages: JS_LIKE,
    concept: 'String literal (URL path)',
    kind: 'literal',
    simpleExplanation:
      'It is the address on the server where the list of users can be requested.',
    definition:
      'A string literal containing a relative URL path. When passed to fetch, it is resolved against the current page origin.',
    contextualExplanation:
      'Because the path starts with "/" and has no domain, the browser sends the request to the same site the page was loaded from, for example "https://yourapp.com/api/users".',
    whyItExists:
      'The server was built to answer requests for user data at this specific path. Paths beginning with "/api/" are a common convention for endpoints that return data instead of pages.',
    relatedConcepts: [
      { label: 'URL' },
      { label: 'endpoint', hint: 'A URL that a server responds to' },
      { label: 'string' },
      { label: 'fetch()' },
    ],
  },
  {
    match: ['url'],
    concept: 'Concept',
    kind: 'literal',
    simpleExplanation: 'A URL is the address of something on the web.',
    definition:
      'A Uniform Resource Locator: a string that identifies the location of a resource and the protocol used to retrieve it.',
    contextualExplanation:
      '"/api/users" is a partial URL. The browser fills in the missing scheme and domain from the current page.',
    whyItExists:
      'Every request needs to say where it is going. URLs are how that destination is written down.',
    relatedConcepts: [{ label: '/api/users' }, { label: 'endpoint' }, { label: 'HTTP request' }],
  },
  {
    match: ['endpoint'],
    concept: 'Concept',
    kind: 'literal',
    simpleExplanation:
      'An endpoint is a specific address on a server that does one job, such as returning the list of users.',
    definition:
      'A network-addressable URL at which an API accepts requests and returns responses for a particular operation.',
    contextualExplanation:
      '"/api/users" is the endpoint this code calls. Other endpoints on the same server might handle logging in or saving a profile.',
    whyItExists:
      'Splitting a server into endpoints keeps each request small and predictable.',
    relatedConcepts: [{ label: '/api/users' }, { label: 'URL' }, { label: 'HTTP request' }],
  },
  {
    match: ['string'],
    concept: 'Data type',
    kind: 'literal',
    simpleExplanation: 'A string is a piece of text.',
    definition:
      'A primitive data type representing an ordered sequence of characters, written between matching quotes.',
    contextualExplanation:
      'The quotes around "/api/users" tell the language to treat it as text rather than as code to run.',
    whyItExists:
      'Programs constantly need to work with text: addresses, names, messages. Strings are how text is represented.',
    relatedConcepts: [{ label: '/api/users' }, { label: 'JSON' }],
  },
  {
    match: ['http request', 'request'],
    concept: 'Concept',
    kind: 'expression',
    simpleExplanation:
      'An HTTP request is a message a program sends to a server asking it to do something, often to hand over some data.',
    definition:
      'A message in the Hypertext Transfer Protocol sent from a client to a server, consisting of a method, a target URL, headers and an optional body.',
    contextualExplanation:
      'Calling "fetch()" builds and sends the request. With no extra options, it uses the GET method, which means "please give me this".',
    whyItExists:
      'Browsers and servers communicate by exchanging HTTP messages. A request is how the conversation starts.',
    relatedConcepts: [{ label: 'HTTP response' }, { label: 'fetch()' }, { label: 'URL' }],
  },
  {
    match: ['http response', 'response object'],
    concept: 'Concept',
    kind: 'expression',
    simpleExplanation:
      'An HTTP response is the server’s reply. It contains a status (did it work?) and usually some content.',
    definition:
      'The message returned by a server in reply to an HTTP request, comprising a status code, headers and an optional body.',
    contextualExplanation:
      'The value stored in "response" is the browser’s representation of this reply. Its body still has to be read, which is what ".json()" does.',
    whyItExists:
      'Every request expects an answer. The response carries both the result and information about whether the request succeeded.',
    relatedConcepts: [{ label: 'HTTP request' }, { label: 'response' }, { label: 'response.json()' }],
  },
  {
    match: ['response'],
    languages: JS_LIKE,
    concept: 'Variable',
    kind: 'identifier',
    simpleExplanation:
      'A name the programmer chose for the reply that came back from the server.',
    definition:
      'An identifier bound to the Response object produced by the awaited fetch call.',
    contextualExplanation:
      '"response" holds everything the server sent back: a status code such as 200 or 404, headers, and the raw body. On the next line, ".json()" is called on it to read that body.',
    whyItExists:
      'The result of the request has to be kept somewhere so the following line can use it. The name "response" describes what it is.',
    relatedConcepts: [
      { label: 'HTTP response' },
      { label: 'fetch()' },
      { label: 'response.json()' },
      { label: 'variable' },
    ],
  },
  {
    match: ['response.json()', '.json()', 'json()'],
    languages: JS_LIKE,
    concept: 'Method call',
    kind: 'call',
    simpleExplanation:
      'A method call that reads the response body and parses it as JSON.',
    definition:
      'A method invocation on a Response object that consumes the response body and returns a Promise resolving to the parsed JavaScript value.',
    contextualExplanation:
      '"response" contains the HTTP response returned by "fetch()". Calling ".json()" reads the response body and converts the JSON text into a JavaScript value that can be used by the program.',
    whyItExists:
      'The server returned structured data, and the program needs to turn that response into something JavaScript can work with.',
    relatedConcepts: [
      { label: 'JSON' },
      { label: 'Promise' },
      { label: 'fetch()' },
      { label: 'HTTP response' },
      { label: 'async / await' },
    ],
  },
  {
    match: ['json'],
    concept: 'Data format',
    kind: 'type',
    simpleExplanation:
      'A common way for programs to package and exchange structured information.',
    definition:
      'JavaScript Object Notation, a text-based data interchange format representing structured data.',
    contextualExplanation:
      'The server sends the user list as JSON text, something like [{"id": 1, "name": "Ada"}]. Calling ".json()" turns that text into real JavaScript objects and arrays.',
    whyItExists:
      'Servers and browsers can be written in different languages. JSON is a neutral format they both understand.',
    relatedConcepts: [
      { label: 'response.json()' },
      { label: 'object', hint: 'A collection of named values' },
      { label: 'array', hint: 'An ordered list of values' },
      { label: 'string' },
    ],
  },
  {
    match: ['object'],
    concept: 'Data type',
    kind: 'type',
    simpleExplanation:
      'An object groups related values together under names, like a record with labeled fields.',
    definition:
      'A collection of key-value pairs, where each key is a string or symbol and each value can be any type.',
    contextualExplanation:
      'Each user returned by the server is an object with fields such as "id", "name" and "email".',
    whyItExists:
      'Real-world things have several properties. Objects keep those properties together so they travel as one unit.',
    relatedConcepts: [{ label: 'array' }, { label: 'JSON' }, { label: 'property' }],
  },
  {
    match: ['array'],
    concept: 'Data type',
    kind: 'type',
    simpleExplanation: 'An array is an ordered list of values.',
    definition:
      'An ordered, integer-indexed collection of values, with a length property and methods for iteration and transformation.',
    contextualExplanation:
      'The user list arrives as an array: one object per user, in the order the server chose.',
    whyItExists:
      'When there are many of something, an array lets the program handle them all with a single name.',
    relatedConcepts: [{ label: 'object' }, { label: 'JSON' }, { label: 'for' }],
  },
  {
    match: ['property'],
    concept: 'Concept',
    kind: 'property',
    simpleExplanation: 'A property is one named value inside an object.',
    definition:
      'A named member of an object, accessed with dot notation (obj.name) or bracket notation (obj["name"]).',
    contextualExplanation:
      'Writing "response.json" reaches into the response object for its "json" property, which happens to be a function.',
    whyItExists:
      'Properties are how the pieces inside an object are addressed individually.',
    relatedConcepts: [{ label: 'object' }, { label: 'method' }],
  },
  {
    match: ['method'],
    concept: 'Concept',
    kind: 'call',
    simpleExplanation: 'A method is a function that belongs to an object.',
    definition:
      'A function-valued property of an object, invoked with the object as its receiver.',
    contextualExplanation:
      '".json()" is a method of the response object. The parentheses run it.',
    whyItExists:
      'Attaching behaviour to the data it works on keeps related code together.',
    relatedConcepts: [{ label: 'function' }, { label: 'object' }, { label: 'property' }],
  },
  {
    match: ['data'],
    languages: JS_LIKE,
    concept: 'Variable',
    kind: 'identifier',
    simpleExplanation:
      'A name the programmer chose for the finished, usable information: the list of users.',
    definition:
      'An identifier bound to the JavaScript value produced by awaiting the parsed JSON response body.',
    contextualExplanation:
      'Once "response.json()" has finished, "data" holds ordinary JavaScript objects and arrays. It is the first point in the code where the user list can actually be read or looped over.',
    whyItExists:
      'The parsed result needs a name so it can be logged, returned or displayed.',
    relatedConcepts: [{ label: 'response.json()' }, { label: 'JSON' }, { label: 'variable' }],
  },
  {
    match: ['console.log', 'console.log()'],
    languages: JS_LIKE,
    concept: 'Method call',
    kind: 'call',
    simpleExplanation:
      'It prints a value to the browser’s developer console so you can see what it contains.',
    definition:
      'A method of the global console object that writes its arguments to the debugging console.',
    contextualExplanation:
      'Whatever is inside the parentheses gets printed. Here it shows the parsed user list, which is a quick way to check that the request worked.',
    whyItExists:
      'Printing values is the simplest way to inspect what a program is doing while building it.',
    relatedConcepts: [
      { label: 'console', hint: 'The browser’s debugging output' },
      { label: 'debugging' },
      { label: 'method' },
    ],
  },
  {
    match: ['console.log(data)', 'console.log(data);'],
    languages: JS_LIKE,
    concept: 'Statement',
    kind: 'statement',
    simpleExplanation:
      'This line prints the user list to the developer console so you can look at it.',
    definition:
      'An expression statement invoking console.log with a single argument, the value bound to "data".',
    contextualExplanation:
      'At this point "data" is the parsed list of users. Logging it lets the person building the app open the browser console and inspect exactly what the server returned.',
    whyItExists:
      'It is a debugging aid. In a finished app this line would usually be removed or replaced with code that displays the users on the page.',
    relatedConcepts: [{ label: 'console.log' }, { label: 'data' }, { label: 'debugging' }],
  },
  {
    match: ['console'],
    languages: JS_LIKE,
    concept: 'Global object',
    kind: 'identifier',
    simpleExplanation:
      'The console is a panel in the browser’s developer tools where programs can print messages.',
    definition:
      'A global object exposing methods for writing to the environment’s debugging console.',
    contextualExplanation:
      '"console" is provided by the browser. The code uses its ".log" method to print the user list.',
    whyItExists:
      'Every environment needs a place for programs to report what they are doing.',
    relatedConcepts: [{ label: 'console.log' }, { label: 'debugging' }],
  },
  {
    match: ['debugging'],
    concept: 'Concept',
    kind: 'statement',
    simpleExplanation:
      'Debugging is the process of figuring out why a program is not behaving as expected.',
    definition:
      'The practice of locating, diagnosing and correcting defects in software.',
    contextualExplanation:
      'The "console.log(data)" line exists for debugging: it lets you see the real data instead of guessing.',
    whyItExists:
      'Programs rarely work the first time. Seeing intermediate values is the fastest way to find out where they go wrong.',
    relatedConcepts: [{ label: 'console.log' }, { label: 'console' }],
  },
  {
    match: ['return'],
    languages: JS_LIKE,
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation:
      'It ends the function and hands a value back to whoever called it.',
    definition:
      'A statement that terminates execution of the current function and specifies the value to be returned to the caller.',
    contextualExplanation:
      'The function returns "data", the parsed user list. Any code that calls this function and awaits it will receive that list.',
    whyItExists:
      'Fetching the users is only useful if other parts of the app can get the result. "return" is how the function shares it.',
    relatedConcepts: [{ label: 'function' }, { label: 'async' }, { label: 'data' }],
  },
  {
    match: ['return data', 'return data;'],
    languages: JS_LIKE,
    concept: 'Return statement',
    kind: 'statement',
    simpleExplanation: 'This sends the user list back to whoever called the function.',
    definition:
      'A return statement whose expression is the identifier "data"; in an async function the returned value becomes the fulfillment value of the returned Promise.',
    contextualExplanation:
      'Because the function is "async", the caller does not receive the list directly but a Promise that resolves to it. Awaiting the call yields the same "data" value.',
    whyItExists:
      'Other code, such as the part that draws the user list on screen, needs access to the result.',
    relatedConcepts: [{ label: 'return' }, { label: 'async' }, { label: 'Promise' }],
  },
  {
    match: ['function'],
    languages: JS_LIKE,
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation:
      'It defines a reusable block of code that you can run by calling its name.',
    definition:
      'A keyword that declares a function: a callable object with its own parameters, body and scope.',
    contextualExplanation:
      'This defines a function named "fetchUsers". The code inside the braces does not run until something calls "fetchUsers()".',
    whyItExists:
      'Wrapping the steps in a function gives them a name and lets them be run whenever the user list is needed.',
    relatedConcepts: [{ label: 'async' }, { label: 'return' }, { label: 'block scope' }],
  },
  {
    match: ['async function fetchusers()', 'async function fetchusers() {', 'fetchusers'],
    languages: JS_LIKE,
    concept: 'Function declaration',
    kind: 'declaration',
    simpleExplanation:
      'This starts the definition of a function called "fetchUsers" that is allowed to wait for slow operations.',
    definition:
      'A function declaration with the async modifier, binding the identifier "fetchUsers" to an asynchronous function that returns a Promise.',
    contextualExplanation:
      'Everything between the braces belongs to "fetchUsers". The "async" modifier is what permits the "await" lines inside.',
    whyItExists:
      'Loading users involves waiting on the network, so the function is declared async. Giving it a name lets the last line of the file call it.',
    relatedConcepts: [{ label: 'function' }, { label: 'async' }, { label: 'await' }],
  },
  {
    match: ['fetchusers()', 'fetchusers();'],
    languages: JS_LIKE,
    concept: 'Function call',
    kind: 'call',
    simpleExplanation: 'This runs the "fetchUsers" function defined above.',
    definition:
      'A call expression invoking the function bound to "fetchUsers" with no arguments.',
    contextualExplanation:
      'Defining a function does not run it. This line actually starts the request. The returned Promise is ignored here, which is fine for a quick demo.',
    whyItExists:
      'Something has to trigger the work. Calling the function at the bottom of the file makes it run as soon as the script loads.',
    relatedConcepts: [{ label: 'function' }, { label: 'Promise' }],
  },
  {
    match: [
      'const response = await fetch("/api/users")',
      "const response = await fetch('/api/users')",
    ],
    languages: JS_LIKE,
    concept: 'Statement',
    kind: 'statement',
    simpleExplanation:
      'This line asks the server for the user list, waits for the reply, and stores it under the name "response".',
    definition:
      'A variable declaration whose initializer awaits the Promise returned by fetch, binding the resulting Response object to the constant "response".',
    contextualExplanation:
      'Reading right to left: "fetch()" sends a request to "/api/users" and returns a Promise; "await" pauses until that Promise resolves; "const response =" saves the resolved Response object under a name.',
    whyItExists:
      'It is the first step of loading data: get the raw reply from the server so the following line can read its contents.',
    relatedConcepts: [
      { label: 'const' },
      { label: 'await' },
      { label: 'fetch()' },
      { label: '/api/users' },
      { label: 'HTTP response' },
    ],
  },
  {
    match: ['const data = await response.json()'],
    languages: JS_LIKE,
    concept: 'Statement',
    kind: 'statement',
    simpleExplanation:
      'This line reads the reply’s contents, converts them from JSON text into usable values, and stores them as "data".',
    definition:
      'A variable declaration whose initializer awaits the Promise returned by Response.prototype.json, binding the parsed value to the constant "data".',
    contextualExplanation:
      '"response.json()" reads the body of the reply and returns a Promise for the parsed value. "await" waits for it. "const data =" gives the finished list a name.',
    whyItExists:
      'The raw response is just bytes. This line turns them into JavaScript objects the program can work with.',
    relatedConcepts: [
      { label: 'response.json()' },
      { label: 'JSON' },
      { label: 'await' },
      { label: 'const' },
    ],
  },
  {
    match: ['import'],
    languages: JS_LIKE,
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation: 'It brings code from another file or package into this one.',
    definition:
      'A declaration that binds exports from another module into the current module’s scope.',
    contextualExplanation:
      'The names listed after "import" become available in this file as if they were defined here.',
    whyItExists:
      'Splitting a program into files keeps it organised. "import" is how files share code.',
    relatedConcepts: [{ label: 'export' }, { label: 'module' }],
  },
  {
    match: ['export'],
    languages: JS_LIKE,
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation:
      'It makes something in this file available for other files to import.',
    definition:
      'A declaration that exposes a binding from the current module so that other modules can import it.',
    contextualExplanation:
      'Marking the interface and the function with "export" means another file could write "import { getUsers } from \'./api\'".',
    whyItExists:
      'This file is meant to be a reusable piece of the app, not something that runs on its own.',
    relatedConcepts: [{ label: 'import' }, { label: 'module' }],
  },
  {
    match: ['module'],
    concept: 'Concept',
    kind: 'declaration',
    simpleExplanation: 'A module is a file whose code can be shared with other files.',
    definition:
      'A self-contained unit of code with its own scope that explicitly exports and imports bindings.',
    contextualExplanation:
      'Because this file uses "export", it is treated as a module.',
    whyItExists:
      'Modules keep names from clashing and make dependencies between files explicit.',
    relatedConcepts: [{ label: 'import' }, { label: 'export' }],
  },
  {
    match: ['interface'],
    languages: ['typescript'],
    concept: 'Type declaration',
    kind: 'type',
    simpleExplanation:
      'It describes the shape of an object: which fields it has and what type each one is.',
    definition:
      'A TypeScript declaration that defines a named object type by listing its members and their types. Interfaces exist only at compile time.',
    contextualExplanation:
      'The "User" interface says every user has a numeric "id" and string "name" and "email". TypeScript uses this to check that the code handles users correctly.',
    whyItExists:
      'Naming the shape once lets the editor catch typos such as "user.emial" before the code ever runs.',
    relatedConcepts: [{ label: 'type annotation' }, { label: 'object' }, { label: 'Promise<User[]>' }],
  },
  {
    match: ['promise<user[]>', ': promise<user[]>'],
    languages: ['typescript'],
    concept: 'Return type annotation',
    kind: 'type',
    simpleExplanation:
      'It says this function will eventually produce a list of User objects.',
    definition:
      'A generic type annotation: a Promise whose fulfillment value is an array of values conforming to the User interface.',
    contextualExplanation:
      'Because "getUsers" is async, its result is always wrapped in a Promise. The annotation tells TypeScript what is inside once it resolves.',
    whyItExists:
      'Callers get autocomplete and type checking on the returned users without reading the function body.',
    relatedConcepts: [{ label: 'Promise' }, { label: 'interface' }, { label: 'type annotation' }],
  },
  {
    match: ['type annotation', 'string', 'number'],
    languages: ['typescript'],
    concept: 'Type annotation',
    kind: 'type',
    simpleExplanation:
      'A type annotation tells TypeScript what kind of value something is expected to hold.',
    definition:
      'A colon followed by a type expression, constraining the declared entity to values of that type at compile time.',
    contextualExplanation:
      'In "id: number" the annotation is ": number". TypeScript will report an error if anything else is assigned.',
    whyItExists:
      'Types let mistakes be found while editing instead of when the app is running.',
    relatedConcepts: [{ label: 'interface' }, { label: 'Promise<User[]>' }],
  },

  // ───────────────────────────────── Python ─────────────────────────────────
  {
    match: ['def'],
    languages: ['python'],
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation: 'It defines a function: a named block of code you can run later.',
    definition:
      'The Python keyword that begins a function definition, binding a name to a callable object.',
    contextualExplanation:
      '"def fetch_users():" creates a function named "fetch_users". The indented lines below it are the function body.',
    whyItExists:
      'Wrapping the steps in a function gives them a name and lets the last line of the file run them.',
    relatedConcepts: [{ label: 'return' }, { label: 'indentation' }, { label: 'function' }],
  },
  {
    match: ['import'],
    languages: ['python'],
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation: 'It loads a library so this file can use the tools inside it.',
    definition:
      'A statement that loads a module and binds it to a name in the current namespace.',
    contextualExplanation:
      '"import requests" makes the "requests" library available, which is what the function uses to talk to the server.',
    whyItExists:
      'Python does not include HTTP helpers by default. Importing "requests" adds that ability.',
    relatedConcepts: [{ label: 'requests' }, { label: 'module' }],
  },
  {
    match: ['requests', 'import requests'],
    languages: ['python'],
    concept: 'Library',
    kind: 'identifier',
    simpleExplanation:
      '"requests" is a popular Python library for sending HTTP requests to servers.',
    definition:
      'A third-party Python package providing a high-level API for issuing HTTP requests and handling responses.',
    contextualExplanation:
      'The code calls "requests.get(...)" to download the user list.',
    whyItExists:
      'It makes talking to web servers much simpler than Python’s built-in tools.',
    relatedConcepts: [{ label: 'requests.get()' }, { label: 'HTTP request' }, { label: 'import' }],
  },
  {
    match: ['requests.get', 'requests.get()', 'requests.get("https://example.com/api/users")'],
    languages: ['python'],
    concept: 'Function call',
    kind: 'call',
    simpleExplanation: 'It asks the server at the given address for some data.',
    definition:
      'A call to the get function of the requests module, which sends an HTTP GET request and returns a Response object.',
    contextualExplanation:
      'Unlike JavaScript’s fetch, this call blocks until the server replies, so no "await" is needed. The reply is stored in "response".',
    whyItExists:
      'The user list lives on a server. This is how the program retrieves it.',
    relatedConcepts: [{ label: 'requests' }, { label: 'HTTP request' }, { label: 'response.json()' }],
  },
  {
    match: ['response', 'data'],
    languages: ['python'],
    concept: 'Variable',
    kind: 'identifier',
    simpleExplanation: 'A name the programmer chose for a value so it can be used on later lines.',
    definition:
      'An identifier bound to a value by assignment; Python variables are created on first assignment.',
    contextualExplanation:
      '"response" holds the server’s reply; "data" holds the parsed list of users taken from it.',
    whyItExists:
      'Each step’s result has to be kept somewhere so the next step can use it.',
    relatedConcepts: [{ label: 'variable' }, { label: 'response.json()' }],
  },
  {
    match: ['response.json()', '.json()'],
    languages: ['python'],
    concept: 'Method call',
    kind: 'call',
    simpleExplanation: 'It converts the server’s JSON reply into Python lists and dictionaries.',
    definition:
      'A method of the requests Response object that parses the response body as JSON and returns the corresponding Python value.',
    contextualExplanation:
      'After this line, "data" is a normal Python list that the "for" loop can walk through.',
    whyItExists:
      'The server sends text. The program needs real Python values to work with.',
    relatedConcepts: [{ label: 'JSON' }, { label: 'requests.get()' }, { label: 'for' }],
  },
  {
    match: ['for', 'for user in data:', 'for user in data'],
    languages: ['python'],
    concept: 'Loop',
    kind: 'keyword',
    simpleExplanation:
      'It repeats the indented lines once for each item in a list.',
    definition:
      'A for statement iterates over the items of an iterable, binding each item in turn to the loop variable and executing the suite.',
    contextualExplanation:
      'Each time around the loop, "user" is one entry from "data". The body prints that user’s name.',
    whyItExists:
      'The server returns many users, and the program wants to do the same thing for every one of them.',
    relatedConcepts: [{ label: 'in' }, { label: 'array' }, { label: 'indentation' }],
  },
  {
    match: ['in'],
    languages: ['python'],
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation: 'Inside a "for" loop, "in" separates the loop variable from the list being walked.',
    definition:
      'In a for statement, the keyword that separates the target from the iterable expression.',
    contextualExplanation:
      '"for user in data" reads as: for each user taken from data.',
    whyItExists: 'It is part of the fixed grammar of a Python loop.',
    relatedConcepts: [{ label: 'for' }],
  },
  {
    match: ['print', 'print()', 'print(user["name"])'],
    languages: ['python'],
    concept: 'Function call',
    kind: 'call',
    simpleExplanation: 'It writes text to the screen (the terminal).',
    definition:
      'A built-in function that writes its arguments to the standard output stream.',
    contextualExplanation:
      'Each pass of the loop prints one user’s name.',
    whyItExists:
      'It is the simplest way to see what a program is doing.',
    relatedConcepts: [{ label: 'debugging' }, { label: 'for' }],
  },
  {
    match: ['user["name"]', "user['name']"],
    languages: ['python'],
    concept: 'Dictionary lookup',
    kind: 'expression',
    simpleExplanation: 'It reads the value stored under the key "name" in the user record.',
    definition:
      'A subscription expression that retrieves the value associated with the key "name" in the mapping bound to "user".',
    contextualExplanation:
      'Each user from the server is a dictionary. This picks out just the name.',
    whyItExists: 'The program only wants to print the name, not the whole record.',
    relatedConcepts: [{ label: 'object' }, { label: 'JSON' }],
  },
  {
    match: ['return'],
    languages: ['python'],
    concept: 'Keyword',
    kind: 'keyword',
    simpleExplanation: 'It ends the function and hands a value back to whoever called it.',
    definition:
      'A statement that exits the current function, optionally passing a value back to the caller.',
    contextualExplanation:
      'The function returns "data", the full list of users, so other code can use it.',
    whyItExists: 'Printing names is nice, but other parts of the program may need the actual data.',
    relatedConcepts: [{ label: 'def' }, { label: 'data' }],
  },
  {
    match: ['indentation'],
    languages: ['python'],
    concept: 'Concept',
    kind: 'statement',
    simpleExplanation:
      'In Python, the spaces at the start of a line decide which block the line belongs to.',
    definition:
      'Leading whitespace that Python uses to delimit compound statements instead of braces.',
    contextualExplanation:
      'The lines indented under "def fetch_users():" are the function body. The line indented under "for" is the loop body.',
    whyItExists: 'Python uses indentation as syntax, so it is required, not just tidy.',
    relatedConcepts: [{ label: 'def' }, { label: 'for' }],
  },

  // ─────────────────────────────────── HTML ───────────────────────────────────
  {
    match: ['<!doctype html>'],
    languages: ['html'],
    concept: 'Document type declaration',
    kind: 'element',
    simpleExplanation: 'It tells the browser this is a modern HTML document.',
    definition:
      'A declaration that identifies the document as HTML5 and switches the browser into standards-compliant rendering mode.',
    contextualExplanation: 'It must be the very first thing in the file, before the <html> tag.',
    whyItExists: 'Without it, browsers fall back to an old "quirks" mode with inconsistent layout rules.',
    relatedConcepts: [{ label: '<html>' }, { label: 'element' }],
  },
  {
    match: ['<html>', '<html lang="en">', 'html'],
    languages: ['html'],
    concept: 'Root element',
    kind: 'element',
    simpleExplanation: 'The outermost tag that wraps the entire page.',
    definition: 'The root element of an HTML document, containing the head and body elements.',
    contextualExplanation:
      'The "lang" attribute tells browsers and screen readers the page is in English.',
    whyItExists: 'Every HTML document needs a single root that everything else lives inside.',
    relatedConcepts: [{ label: '<head>' }, { label: '<body>' }, { label: 'attribute' }],
  },
  {
    match: ['<head>', 'head'],
    languages: ['html'],
    concept: 'Element',
    kind: 'element',
    simpleExplanation: 'It holds information about the page that is not shown directly, such as its title.',
    definition: 'A container for document metadata, including the title, character encoding and linked resources.',
    contextualExplanation: 'Here it sets the character encoding, the tab title and links the stylesheet.',
    whyItExists: 'Browsers need setup information before rendering the visible content.',
    relatedConcepts: [{ label: '<body>' }, { label: '<link>' }, { label: '<title>' }],
  },
  {
    match: ['<body>', 'body'],
    languages: ['html'],
    concept: 'Element',
    kind: 'element',
    simpleExplanation: 'It contains everything the user actually sees on the page.',
    definition: 'The element containing the document’s renderable content.',
    contextualExplanation: 'The body holds a single empty <div> that JavaScript will fill with users, plus the script that does so.',
    whyItExists: 'Separating visible content from metadata keeps documents organised.',
    relatedConcepts: [{ label: '<head>' }, { label: '<div>' }, { label: '<script>' }],
  },
  {
    match: ['<title>', '<title>user directory</title>', 'title'],
    languages: ['html'],
    concept: 'Element',
    kind: 'element',
    simpleExplanation: 'It sets the text shown in the browser tab.',
    definition: 'An element in the head that specifies the document’s title, used by the browser chrome, bookmarks and search engines.',
    contextualExplanation: 'The tab will read "User Directory".',
    whyItExists: 'Every page needs a name so people can find it among their tabs.',
    relatedConcepts: [{ label: '<head>' }],
  },
  {
    match: ['<link>', '<link rel="stylesheet" href="styles.css" />', 'link'],
    languages: ['html'],
    concept: 'Element',
    kind: 'element',
    simpleExplanation: 'It attaches an external file, in this case the stylesheet, to the page.',
    definition: 'A void element that establishes a relationship between the document and an external resource.',
    contextualExplanation: '"rel=\\"stylesheet\\"" says the file is CSS; "href" says where to find it.',
    whyItExists: 'Keeping styles in a separate file lets many pages share the same look.',
    relatedConcepts: [{ label: 'attribute' }, { label: '<head>' }],
  },
  {
    match: ['<div>', '<div id="app" class="container"></div>', 'div'],
    languages: ['html'],
    concept: 'Element',
    kind: 'element',
    simpleExplanation: 'A generic box for grouping content. On its own it has no meaning or appearance.',
    definition: 'A block-level flow content container with no semantic meaning, used for grouping and styling.',
    contextualExplanation:
      'This div is empty in the HTML. The "id" lets JavaScript find it, and the "class" lets CSS style it. The script will insert the user list inside.',
    whyItExists: 'The app needs a known place in the page to put content that arrives later.',
    relatedConcepts: [{ label: 'attribute' }, { label: 'class' }, { label: 'id' }],
  },
  {
    match: ['<script>', '<script src="fetchusers.js"></script>', 'script'],
    languages: ['html'],
    concept: 'Element',
    kind: 'element',
    simpleExplanation: 'It loads and runs a JavaScript file as part of the page.',
    definition: 'An element that embeds or references executable script, executed by the browser when encountered.',
    contextualExplanation:
      'It points at "fetchUsers.js". Placing it at the end of the body means the div above already exists when the script runs.',
    whyItExists: 'Without JavaScript the page would just be an empty box. The script fetches and shows the users.',
    relatedConcepts: [{ label: 'attribute' }, { label: '<body>' }],
  },
  {
    match: ['attribute', 'class="container"', 'id="app"', 'lang="en"', 'charset="utf-8"'],
    languages: ['html'],
    concept: 'Attribute',
    kind: 'property',
    simpleExplanation: 'Attributes are extra settings written inside an opening tag, as name="value" pairs.',
    definition: 'A name-value pair on an element’s start tag that configures its behaviour or provides metadata.',
    contextualExplanation: 'For example "class" and "id" on the div give it hooks for CSS and JavaScript.',
    whyItExists: 'Tags alone cannot carry enough information. Attributes add the details.',
    relatedConcepts: [{ label: 'class' }, { label: 'id' }, { label: 'element' }],
  },
  {
    match: ['class'],
    languages: ['html'],
    concept: 'Attribute',
    kind: 'property',
    simpleExplanation: 'A label you can put on any element so CSS can style all elements with that label.',
    definition: 'A global attribute holding a space-separated list of class names used for styling and selection.',
    contextualExplanation: 'The div is labelled "container", which matches the ".container" rule in styles.css.',
    whyItExists: 'Classes let one style rule apply to many elements.',
    relatedConcepts: [{ label: 'attribute' }, { label: '.container' }],
  },
  {
    match: ['id'],
    languages: ['html'],
    concept: 'Attribute',
    kind: 'property',
    simpleExplanation: 'A unique name for one element so scripts and links can find it.',
    definition: 'A global attribute assigning a document-wide unique identifier to an element.',
    contextualExplanation: 'JavaScript can call document.getElementById("app") to get this div.',
    whyItExists: 'The script needs a reliable way to locate the box it should fill.',
    relatedConcepts: [{ label: 'attribute' }, { label: 'class' }],
  },
  {
    match: ['element'],
    languages: ['html'],
    concept: 'Concept',
    kind: 'element',
    simpleExplanation: 'An element is one building block of a page, written as an opening tag, content, and a closing tag.',
    definition: 'A node in the HTML document tree, delimited by start and end tags and possibly containing attributes and children.',
    contextualExplanation: 'The html, head, body, div and script tags are all elements nested inside one another.',
    whyItExists: 'Pages are built as a tree of elements. Everything on screen is one.',
    relatedConcepts: [{ label: 'attribute' }, { label: '<div>' }],
  },

  // ─────────────────────────────────── CSS ───────────────────────────────────
  {
    match: [':root'],
    languages: ['css'],
    concept: 'Pseudo-class selector',
    kind: 'selector',
    simpleExplanation: 'It targets the whole document, so values set here are available everywhere.',
    definition: 'A pseudo-class matching the document’s root element, equivalent to "html" but with higher specificity.',
    contextualExplanation: 'The "--accent" variable is declared here so every rule in the file can use it.',
    whyItExists: 'It is the conventional place to define global design values.',
    relatedConcepts: [{ label: '--accent' }, { label: 'selector' }, { label: 'var()' }],
  },
  {
    match: ['--accent', '--accent: #4f7cff', '--accent: #4f7cff;'],
    languages: ['css'],
    concept: 'Custom property',
    kind: 'property',
    simpleExplanation: 'A named colour you define once and reuse anywhere with var(--accent).',
    definition: 'A CSS custom property (variable) declared with a double-dash prefix and read with the var() function.',
    contextualExplanation: 'It stores the blue "#4f7cff". The heading rule later reads it with "var(--accent)".',
    whyItExists: 'Changing the accent colour in one place updates it everywhere.',
    relatedConcepts: [{ label: 'var()' }, { label: ':root' }, { label: '#4f7cff' }],
  },
  {
    match: ['#4f7cff'],
    languages: ['css'],
    concept: 'Hex colour',
    kind: 'literal',
    simpleExplanation: 'A colour written as six hexadecimal digits: red, green and blue amounts.',
    definition: 'A hexadecimal colour notation specifying red, green and blue channels as two-digit hex values.',
    contextualExplanation: '"4f" red, "7c" green and "ff" blue produce a medium blue.',
    whyItExists: 'Hex is a compact, widely supported way to write exact colours.',
    relatedConcepts: [{ label: '--accent' }, { label: 'color' }],
  },
  {
    match: ['var()', 'var(--accent)'],
    languages: ['css'],
    concept: 'Function',
    kind: 'call',
    simpleExplanation: 'It reads the value of a custom property.',
    definition: 'A CSS function that substitutes the value of a custom property at computation time.',
    contextualExplanation: '"color: var(--accent)" makes headings the blue defined at the top.',
    whyItExists: 'It is the only way to use a custom property’s value.',
    relatedConcepts: [{ label: '--accent' }, { label: ':root' }],
  },
  {
    match: ['.container', '.container {'],
    languages: ['css'],
    concept: 'Class selector',
    kind: 'selector',
    simpleExplanation: 'It matches every element whose class attribute includes "container".',
    definition: 'A selector that matches elements with the given class name, written with a leading period.',
    contextualExplanation: 'It matches the <div class="container"> in index.html and lays it out as a column.',
    whyItExists: 'Classes connect HTML elements to the styles meant for them.',
    relatedConcepts: [{ label: 'selector' }, { label: 'class' }, { label: 'display: flex' }],
  },
  {
    match: ['selector'],
    languages: ['css'],
    concept: 'Concept',
    kind: 'selector',
    simpleExplanation: 'A selector is the part of a CSS rule that says which elements the rule applies to.',
    definition: 'A pattern matching elements in the document tree, forming the subject of a style rule.',
    contextualExplanation: '":root", ".container" and ".container h1" are the three selectors in this file.',
    whyItExists: 'Styles have to be aimed at something.',
    relatedConcepts: [{ label: '.container' }, { label: ':root' }],
  },
  {
    match: ['display: flex', 'display: flex;', 'flex'],
    languages: ['css'],
    concept: 'Property declaration',
    kind: 'property',
    simpleExplanation: 'It turns the element into a flexible container that lines its children up in a row or column.',
    definition: 'Sets the element’s display type to a flex container, establishing a flex formatting context for its children.',
    contextualExplanation: 'Combined with "flex-direction: column", the container stacks each user vertically.',
    whyItExists: 'Flexbox is the simplest way to control spacing and alignment of a group of items.',
    relatedConcepts: [{ label: 'flex-direction' }, { label: 'gap' }, { label: 'padding' }],
  },
  {
    match: ['flex-direction', 'flex-direction: column', 'flex-direction: column;'],
    languages: ['css'],
    concept: 'Property declaration',
    kind: 'property',
    simpleExplanation: 'It chooses whether flex items go left-to-right or top-to-bottom.',
    definition: 'Specifies the main axis of a flex container: row (default) or column.',
    contextualExplanation: '"column" stacks the children vertically.',
    whyItExists: 'A list of users reads better as a column than a row.',
    relatedConcepts: [{ label: 'display: flex' }, { label: 'gap' }],
  },
  {
    match: ['gap', 'gap: 12px', 'gap: 12px;'],
    languages: ['css'],
    concept: 'Property declaration',
    kind: 'property',
    simpleExplanation: 'It adds space between the items inside a flex or grid container.',
    definition: 'Sets the size of the gutters between rows and columns in a flex or grid container.',
    contextualExplanation: 'Each user in the list gets 12 pixels of breathing room from the next.',
    whyItExists: 'It is cleaner than adding margins to every child.',
    relatedConcepts: [{ label: 'display: flex' }, { label: 'padding' }],
  },
  {
    match: ['padding', 'padding: 24px', 'padding: 24px;'],
    languages: ['css'],
    concept: 'Property declaration',
    kind: 'property',
    simpleExplanation: 'It adds space inside the element, between its edge and its content.',
    definition: 'Sets the padding area on all four sides of an element.',
    contextualExplanation: 'The container gets 24 pixels of inner space so the list does not touch the edge.',
    whyItExists: 'Content pressed against an edge feels cramped.',
    relatedConcepts: [{ label: 'gap' }, { label: 'display: flex' }],
  },
  {
    match: ['color', 'color: var(--accent)', 'color: var(--accent);'],
    languages: ['css'],
    concept: 'Property declaration',
    kind: 'property',
    simpleExplanation: 'It sets the text colour.',
    definition: 'Sets the foreground colour of an element’s text content.',
    contextualExplanation: 'Headings inside the container use the accent blue.',
    whyItExists: 'A coloured heading gives the page a visual identity.',
    relatedConcepts: [{ label: 'var()' }, { label: '--accent' }],
  },

  // ─────────────────────────────────── JSON ───────────────────────────────────
  {
    match: ['"name"', 'name'],
    languages: ['json'],
    concept: 'Key',
    kind: 'property',
    simpleExplanation: 'The package’s name.',
    definition: 'A string key in the root object of package.json identifying the package.',
    contextualExplanation: 'This project is called "user-directory".',
    whyItExists: 'Tools such as npm use the name to identify the project.',
    relatedConcepts: [{ label: 'JSON' }, { label: 'object' }],
  },
  {
    match: ['"scripts"', 'scripts'],
    languages: ['json'],
    concept: 'Key',
    kind: 'property',
    simpleExplanation: 'A list of named commands you can run with "npm run".',
    definition: 'An object in package.json mapping script names to shell commands executed by the package manager.',
    contextualExplanation: '"npm run dev" starts the development server; "npm run build" creates a production build.',
    whyItExists: 'It gives every project the same simple way to start common tasks.',
    relatedConcepts: [{ label: '"dependencies"' }, { label: 'object' }],
  },
  {
    match: ['"dependencies"', 'dependencies'],
    languages: ['json'],
    concept: 'Key',
    kind: 'property',
    simpleExplanation: 'The list of libraries this project needs to run.',
    definition: 'An object in package.json mapping package names to version ranges that must be installed.',
    contextualExplanation: 'The project depends on React, version 19 or a compatible newer release.',
    whyItExists: 'Anyone who clones the project can run "npm install" and get the same libraries.',
    relatedConcepts: [{ label: '"scripts"' }, { label: '^19.0.0' }],
  },
  {
    match: ['^19.0.0', '"^19.0.0"'],
    languages: ['json'],
    concept: 'Version range',
    kind: 'literal',
    simpleExplanation: 'It allows any version 19.x.x, but not version 20.',
    definition: 'A semantic-versioning caret range permitting updates that do not change the leftmost non-zero version number.',
    contextualExplanation: 'The project will accept 19.0.0, 19.2.5 and so on, but not a breaking 20.0.0 release.',
    whyItExists: 'It lets the project receive bug fixes automatically while avoiding breaking changes.',
    relatedConcepts: [{ label: '"dependencies"' }],
  },
  {
    match: ['"version"', 'version'],
    languages: ['json'],
    concept: 'Key',
    kind: 'property',
    simpleExplanation: 'The version number of this project.',
    definition: 'A string in package.json following semantic versioning: major.minor.patch.',
    contextualExplanation: '1.0.0 usually marks a first stable release.',
    whyItExists: 'Version numbers let people know which build they are using.',
    relatedConcepts: [{ label: '^19.0.0' }, { label: '"name"' }],
  },
  {
    match: ['object'],
    languages: ['json'],
    concept: 'Data type',
    kind: 'type',
    simpleExplanation: 'A set of named values wrapped in curly braces.',
    definition: 'A JSON object: an unordered collection of string keys and values enclosed in braces.',
    contextualExplanation: 'The whole file is one object; "scripts" and "dependencies" are nested objects.',
    whyItExists: 'Objects are how JSON represents records with named fields.',
    relatedConcepts: [{ label: 'JSON' }, { label: '"scripts"' }],
  },
]
