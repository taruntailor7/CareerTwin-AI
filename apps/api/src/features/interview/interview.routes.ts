import { Router, type Request, type Response } from "express";
import { store } from "../../lib/store.js";
import { type AuthenticatedRequest } from "../../middleware/auth.js";
import { submitInterviewAnswerSchema } from "./interview.schemas.js";

const INTERVIEW_QUESTION_BANK = [
  "What kind of work makes you lose track of time?",
  "Which project are you most proud of, and what was your direct impact?",
  "What leadership moments shaped your career confidence?",
  "What type of company culture consistently drains your energy?",
  "What are you optimizing for in your next 12 months: title, learning, salary, or flexibility?",
  "How do you usually approach ambiguity and unclear requirements?",
  "What is one risk you are willing to take now that you were not willing to take last year?",
  "What weakness could block your next career level if left unresolved?"
];

export const interviewRouter = Router();

interviewRouter.get("/profile/:profileId", (req: Request, res: Response) => {
  const profile = store.getProfile(String(req.params.profileId));
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const existing = store.getInterviewSession(profile.id);
  if (existing) {
    return res.status(200).json({ data: existing });
  }

  const initial = store.saveInterviewSession({
    profileId: profile.id,
    answered: [],
    nextQuestion: INTERVIEW_QUESTION_BANK[0],
    isComplete: false
  });

  return res.status(200).json({ data: initial });
});

interviewRouter.post("/answer", (req: Request, res: Response) => {
  const parsed = submitInterviewAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid interview payload.", details: parsed.error.flatten() });
  }

  const profile = store.getProfile(parsed.data.profileId);
  if (!profile || profile.clerkUserId !== (req as AuthenticatedRequest).authUserId) {
    return res.status(403).json({ error: "Forbidden profile access." });
  }

  const current = store.getInterviewSession(profile.id) ?? {
    profileId: profile.id,
    answered: [],
    nextQuestion: INTERVIEW_QUESTION_BANK[0],
    isComplete: false
  };

  const activeQuestion = current.nextQuestion ?? INTERVIEW_QUESTION_BANK[current.answered.length] ?? null;
  if (!activeQuestion) {
    return res.status(409).json({ error: "Interview is already complete." });
  }

  const answered = [...current.answered, { question: activeQuestion, answer: parsed.data.answer }];
  const nextQuestion = INTERVIEW_QUESTION_BANK[answered.length] ?? null;
  const isComplete = answered.length >= 6 || nextQuestion === null;

  const saved = store.saveInterviewSession({
    profileId: profile.id,
    answered,
    nextQuestion,
    isComplete
  });

  return res.status(200).json({ data: saved });
});
