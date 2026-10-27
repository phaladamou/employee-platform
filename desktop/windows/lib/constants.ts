// lib/constants.ts

import { BookOpenIcon, Code2Icon, FlaskConicalIcon } from "lucide-react";
import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  {
    label: "Learn",
    icon: BookOpenIcon,
    prompts: [
      "Explain quantum entanglement in simple terms",
      "Teach me the basics of linear algebra",
      "What is the history of artificial intelligence?",
      "How does CRISPR gene editing work?",
    ],
  },
  {
    label: "Solve",
    icon: FlaskConicalIcon,
    prompts: [
      "Solve this differential equation: dy/dx = y + x²",
      "Calculate the probability of rolling two sixes",
      "Balance this chemical equation: H₂ + O₂ → H₂O",
      "Find the eigenvalues of this 3x3 matrix",
    ],
  },
  {
    label: "Code",
    icon: Code2Icon,
    prompts: [
      "Write a Python function to sort a list",
      "Create a simple neural network from scratch",
      "Debug this recursive Fibonacci function",
      "Implement a binary search algorithm",
    ],
  },
];
