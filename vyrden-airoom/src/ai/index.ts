// VYRDON AI Room — Main Module
// vyrden.com — Hidden Operations Center

// Gateway (central orchestration)
export { AIRoomGateway, getGateway } from './gateway.js';
export type {
  Task as GatewayTask,
  TaskPriority as GatewayTaskPriority,
  TaskStatus as GatewayTaskStatus,
  GatewayStats,
} from './gateway.js';

// Inference
export { InferenceManager, inferenceManager, OllamaProvider, InferenceRouter, getInferenceRouter } from './inference/index.js';
export type {
  InferenceRequest,
  InferenceResponse,
  InferenceProvider,
  StreamChunk,
  InferenceMode,
  RouterConfig,
} from './inference/index.js';

// Embeddings
export { EmbeddingsManager, embeddingsManager, VectorStore } from './embeddings/index.js';
export type {
  EmbeddingRequest,
  EmbeddingResult,
  VectorDocument,
  VectorSearchResult,
} from './embeddings/index.js';

// Orchestration
export { TaskScheduler, taskScheduler } from './orchestration/index.js';
export type {
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  AgentCapability,
  OrchestrationPlan,
} from './orchestration/index.js';

// Tool Guard
export { ToolGuard, toolGuard } from './tool-guard/index.js';
export type {
  ToolDefinition,
  ToolParameter,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolPolicy,
  ToolPermission,
  ToolCategory,
} from './tool-guard/index.js';

// Events
export { EventBus, eventBus } from './events/index.js';
export type {
  AIEvent,
  EventHandler,
  EventSubscription,
  EventFilter,
  EventCategory,
  EventPriority,
} from './events/index.js';

// Language
export { LanguageManager, languageManager, OllamaLanguageProvider } from './language/index.js';
export type {
  LanguageCode,
  TranslationRequest,
  TranslationResult,
  LanguageDetectionResult,
  SentimentResult,
  EntityExtractionResult,
  SummarizationRequest,
  SummarizationResult,
} from './language/index.js';

// Calendar
export { CalendarEngine, calendarEngine } from './calendar/index.js';
export type {
  CalendarEvent,
  CalendarQuery,
  CalendarStats,
  EventStatus as CalendarEventStatus,
  EventPriority as CalendarEventPriority,
  RecurrenceRule,
  Reminder,
  ScheduleRequest,
  ScheduleResult,
  TimeSlot,
} from './calendar/index.js';
