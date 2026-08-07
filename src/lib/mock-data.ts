import type { Conversation, MessageModelInfo } from "#lib/types/chat";

const DEFAULT_MESSAGE_MODEL: MessageModelInfo = {
  providerId: "opencode-go",
  providerName: "Opencode Go",
  modelId: "openai/gpt-4o",
  modelName: "GPT-4o",
};

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    title: "React counter hook",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45),
    messages: [
      {
        id: "msg-1-1",
        role: "user",
        content: "Show me a simple React counter using a custom hook.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      },
      {
        id: "msg-1-2",
        role: "assistant",
        content:
          "Here is a minimal counter driven by a custom `useCounter` hook.\n\n```tsx\nimport { useState } from 'react';\n\nfunction useCounter(initial = 0) {\n  const [count, setCount] = useState(initial);\n  const increment = () => setCount((c) => c + 1);\n  const decrement = () => setCount((c) => c - 1);\n  const reset = () => setCount(initial);\n  return { count, increment, decrement, reset };\n}\n\nexport default function Counter() {\n  const { count, increment, decrement, reset } = useCounter(0);\n\n  return (\n    <div className=\"flex items-center gap-4\">\n      <button onClick={decrement}>-</button>\n      <span>{count}</span>\n      <button onClick={increment}>+</button>\n      <button onClick={reset}>Reset</button>\n    </div>\n  );\n}\n```",
        model: DEFAULT_MESSAGE_MODEL,
        thinkingLevel: "off",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 1000),
      },
      {
        id: "msg-1-3",
        role: "user",
        content: "Can you also make it accept a step value?",
        createdAt: new Date(Date.now() - 1000 * 60 * 50),
      },
      {
        id: "msg-1-4",
        role: "assistant",
        content:
          "Sure - pass a `step` argument and use it inside `increment` and `decrement`.\n\n```tsx\nfunction useCounter(initial = 0, step = 1) {\n  const [count, setCount] = useState(initial);\n  const increment = () => setCount((c) => c + step);\n  const decrement = () => setCount((c) => c - step);\n  const reset = () => setCount(initial);\n  return { count, increment, decrement, reset };\n}\n```",
        model: DEFAULT_MESSAGE_MODEL,
        thinkingLevel: "off",
        createdAt: new Date(Date.now() - 1000 * 60 * 45),
      },
    ],
  },
  {
    id: "conv-2",
    title: "Trip to Kyoto",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    messages: [
      {
        id: "msg-2-1",
        role: "user",
        content: "Plan a 3-day itinerary for Kyoto in spring.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      },
      {
        id: "msg-2-2",
        role: "assistant",
        content:
          "Spring in Kyoto is cherry-blossom season, so I will keep the days centered on hanami spots while mixing in temples and food.\n\n### Day 1 - Higashiyama\n- Early morning at Kiyomizu-dera\n- Walk through Ninenzaka and Sannenzaka\n- Lunch: yudofu in the temple district\n- Maruyama Park for evening hanami\n\n### Day 2 - Arashiyama\n- Bamboo Grove at dawn to avoid crowds\n- Tenryu-ji temple\n- Togetsukyo Bridge\n- Kimono Forest at Randen station\n\n### Day 3 - Northern Kyoto\n- Kinkaku-ji (Golden Pavilion)\n- Ryoan-ji rock garden\n- Ninnaji temple\n- Cherry blossoms along the Kamo River",
        reasoning: {
          content:
            "The user wants a 3-day spring itinerary. I should spread attractions geographically to minimize travel time and prioritize cherry-blossom locations since that is the main draw in spring.",
          isCollapsed: true,
        },
        model: DEFAULT_MESSAGE_MODEL,
        thinkingLevel: "off",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 + 2000),
      },
      {
        id: "msg-2-3",
        role: "user",
        content: "Which day has the best food options?",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
      },
    ],
  },
  {
    id: "conv-3",
    title: "Rust error handling",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    messages: [
      {
        id: "msg-3-1",
        role: "user",
        content: "Explain Rust's `Result` and `?` operator with a short example.",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      },
      {
        id: "msg-3-2",
        role: "assistant",
        content:
          "`Result<T, E>` represents either success (`Ok(T)`) or failure (`Err(E)`). The `?` operator unwraps `Ok` values and returns `Err` early.\n\n```rust\nuse std::fs::File;\nuse std::io::{self, Read};\n\nfn read_username(path: &str) -> Result<String, io::Error> {\n    let mut file = File::open(path)?;\n    let mut name = String::new();\n    file.read_to_string(&mut name)?;\n    Ok(name)\n}\n```\n\nBoth `?` calls propagate the same `io::Error` type.",
        model: DEFAULT_MESSAGE_MODEL,
        thinkingLevel: "off",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4 + 1500),
      },
      {
        id: "msg-3-3",
        role: "user",
        content: "What about the `try` blocks RFC?",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      },
      {
        id: "msg-3-4",
        role: "assistant",
        content:
          'The `try` blocks RFC is still unstable. It lets you scope error propagation inside a block without needing a separate function.\n\n```rust\n#![feature(try_blocks)]\n\nlet result: Result<i32, ParseIntError> = try {\n    let a = "1".parse::<i32>()?;\n    let b = "2".parse::<i32>()?;\n    a + b\n};\n```\n\nUse it only on nightly for experimentation.',
        model: DEFAULT_MESSAGE_MODEL,
        thinkingLevel: "off",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000),
      },
    ],
  },
];
