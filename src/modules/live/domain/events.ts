export type MatchStartedEvent = {
  type: "MatchStarted";
  num: number;
};

export type MatchScoreChangedEvent = {
  type: "MatchScoreChanged";
  num: number;
  goals1: number;
  goals2: number;
};

export type MatchPenaltiesChangedEvent = {
  type: "MatchPenaltiesChanged";
  num: number;
  pen1: number;
  pen2: number;
};

export type MatchFinishedEvent = {
  type: "MatchFinished";
  num: number;
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
};

export type LiveDomainEvent =
  | MatchStartedEvent
  | MatchScoreChangedEvent
  | MatchPenaltiesChangedEvent
  | MatchFinishedEvent;
