export const props = {
  "epic": [],
  "task": [
    {
      "key": "movementField1",
      "label": "Note",
      "type": "string"
    }
  ],
  "subtask": [
    {
      "key": "updates",
      "label": "Updates",
      "type": "markdown",
      "help": "Log progress newest-first: what you did, what's blocked, what's next. Not a discussion thread; one update per section, dates optional."
    }
  ]
} as const;
