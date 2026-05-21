"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SESSIONS as STATIC_SESSIONS, CURRICULUM_WEEKS } from "@/data/sessions";
import { useSessions } from "@/hooks/useSessions";
import { BookOpen, Code2, Link2, FileText, Globe } from "lucide-react";

const GithubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { trackActivity } from "@/lib/activityApi";

type SubmitType = "assignment" | "project";

export default function SubmitPage() {
  const { user, userProfile, loading } = useAuth();
  const { sessions: liveSessions } = useSessions();
  const programmeSessions = useMemo(
    () => (liveSessions.length > 0 ? liveSessions : STATIC_SESSIONS),
    [liveSessions]
  );
  const router = useRouter();
  const [submitType, setSubmitType] = useState<SubmitType>("assignment");
  const [submitting, setSubmitting] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    weekNumber: 1,
    sessionId: "",
    title: "",
    description: "",
    githubUrl: "",
    notebookUrl: "",
    demoUrl: "",
  });

  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
    techStack: "",
    githubUrl: "",
    demoUrl: "",
    weekCompleted: 4,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const validateAssignment = () => {
    const e: Record<string, string> = {};
    if (!assignmentForm.title.trim()) e.title = "Title is required";
    if (!assignmentForm.description.trim())
      e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateProject = () => {
    const e: Record<string, string> = {};
    if (!projectForm.title.trim()) e.title = "Title is required";
    if (!projectForm.description.trim())
      e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAssignment()) return;
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "assignments"), {
        userId: user!.uid,
        userName: userProfile?.displayName || user!.email,
        weekNumber: assignmentForm.weekNumber,
        sessionId: assignmentForm.sessionId,
        title: assignmentForm.title,
        description: assignmentForm.description,
        githubUrl: assignmentForm.githubUrl,
        notebookUrl: assignmentForm.notebookUrl,
        demoUrl: assignmentForm.demoUrl,
        status: "submitted",
        submittedAt: serverTimestamp(),
        submittedAtClient: new Date().toISOString(),
      });
      trackActivity({
        type: "assignment_submitted",
        assignmentId: docRef.id,
        sessionId: assignmentForm.sessionId || undefined,
        sessionTitle: assignmentForm.title,
      });
      toast.success("Assignment submitted successfully! 🎉");
      setAssignmentForm({
        weekNumber: 1,
        sessionId: "",
        title: "",
        description: "",
        githubUrl: "",
        notebookUrl: "",
        demoUrl: "",
      });
      setErrors({});
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateProject()) return;
    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "projects"), {
        userId: user!.uid,
        userName: userProfile?.displayName || user!.email,
        title: projectForm.title,
        description: projectForm.description,
        techStack: projectForm.techStack
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        githubUrl: projectForm.githubUrl,
        demoUrl: projectForm.demoUrl,
        weekCompleted: projectForm.weekCompleted,
        status: "submitted",
        submittedAt: serverTimestamp(),
        submittedAtClient: new Date().toISOString(),
      });
      trackActivity({
        type: "project_submitted",
        projectId: docRef.id,
        sessionTitle: projectForm.title,
      });
      toast.success("Project submitted successfully! 🚀");
      setProjectForm({
        title: "",
        description: "",
        techStack: "",
        githubUrl: "",
        demoUrl: "",
        weekCompleted: 4,
      });
      setErrors({});
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Submit Your Work</h1>
          <p className="text-gray-400">
            Share your weekly assignments or final projects with mentors.
          </p>
        </div>

        {/* Type Toggle */}
        <div className="flex bg-gray-900 border border-white/10 rounded-xl p-1 mb-8">
          <button
            onClick={() => {
              setSubmitType("assignment");
              setErrors({});
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              submitType === "assignment"
                ? "bg-purple-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <BookOpen size={16} />
            Weekly Assignment
          </button>
          <button
            onClick={() => {
              setSubmitType("project");
              setErrors({});
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              submitType === "project"
                ? "bg-green-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Code2 size={16} />
            Final Project
          </button>
        </div>

        {submitType === "assignment" ? (
          <form
            onSubmit={handleSubmitAssignment}
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Week Number
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CURRICULUM_WEEKS.map((w) => (
                  <button
                    key={w.week}
                    type="button"
                    onClick={() =>
                      setAssignmentForm({
                        ...assignmentForm,
                        weekNumber: w.week,
                      })
                    }
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                      assignmentForm.weekNumber === w.week
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    Week {w.week}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Related Session{" "}
                <span className="text-gray-500">(optional)</span>
              </label>
              <select
                value={assignmentForm.sessionId}
                onChange={(e) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    sessionId: e.target.value,
                  })
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— Select session —</option>
                {programmeSessions.filter(
                  (s) => s.week === assignmentForm.weekNumber
                ).map((s) => (
                  <option key={s.id} value={s.id}>
                    Session {s.number}: {s.title}
                  </option>
                ))}
              </select>
            </div>

            <Input
              id="asn-title"
              label="Assignment Title *"
              placeholder="e.g. Calculator App in Python"
              icon={<FileText size={16} />}
              value={assignmentForm.title}
              onChange={(e) =>
                setAssignmentForm({ ...assignmentForm, title: e.target.value })
              }
              error={errors.title}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Description *
              </label>
              <textarea
                rows={4}
                placeholder="Describe what you built and what you learned..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                value={assignmentForm.description}
                onChange={(e) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    description: e.target.value,
                  })
                }
              />
              {errors.description && (
                <p className="text-xs text-red-400 mt-1">{errors.description}</p>
              )}
            </div>

            <Input
              id="asn-github"
              label="GitHub Repository"
              placeholder="https://github.com/yourname/repo"
              icon={<GithubIcon />}
              value={assignmentForm.githubUrl}
              onChange={(e) =>
                setAssignmentForm({
                  ...assignmentForm,
                  githubUrl: e.target.value,
                })
              }
            />

            <Input
              id="asn-notebook"
              label="Google Colab / Notebook URL"
              placeholder="https://colab.research.google.com/..."
              icon={<Link2 size={16} />}
              value={assignmentForm.notebookUrl}
              onChange={(e) =>
                setAssignmentForm({
                  ...assignmentForm,
                  notebookUrl: e.target.value,
                })
              }
            />

            <Input
              id="asn-demo"
              label="Demo URL"
              placeholder="https://your-demo.com"
              icon={<Globe size={16} />}
              value={assignmentForm.demoUrl}
              onChange={(e) =>
                setAssignmentForm({ ...assignmentForm, demoUrl: e.target.value })
              }
            />

            <Button
              type="submit"
              loading={submitting}
              className="w-full !bg-purple-600 hover:!bg-purple-700 focus:!ring-purple-500"
              size="lg"
            >
              Submit Assignment
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleSubmitProject}
            className="bg-gray-900 border border-white/10 rounded-2xl p-6 sm:p-8 space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Week Completed
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() =>
                      setProjectForm({ ...projectForm, weekCompleted: w })
                    }
                    className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                      projectForm.weekCompleted === w
                        ? "bg-green-600 border-green-500 text-white"
                        : "border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    Week {w}
                  </button>
                ))}
              </div>
            </div>

            <Input
              id="proj-title"
              label="Project Title *"
              placeholder="e.g. Handwritten Digit Classifier"
              icon={<FileText size={16} />}
              value={projectForm.title}
              onChange={(e) =>
                setProjectForm({ ...projectForm, title: e.target.value })
              }
              error={errors.title}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Project Description *
              </label>
              <textarea
                rows={5}
                placeholder="Describe your project — what it does, how it works, and what you're proud of..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                value={projectForm.description}
                onChange={(e) =>
                  setProjectForm({
                    ...projectForm,
                    description: e.target.value,
                  })
                }
              />
              {errors.description && (
                <p className="text-xs text-red-400 mt-1">{errors.description}</p>
              )}
            </div>

            <Input
              id="proj-tech"
              label="Tech Stack"
              placeholder="TypeScript, Google ADK, Vertex AI, LangChain (comma-separated)"
              icon={<Code2 size={16} />}
              value={projectForm.techStack}
              onChange={(e) =>
                setProjectForm({ ...projectForm, techStack: e.target.value })
              }
            />

            <Input
              id="proj-github"
              label="GitHub Repository"
              placeholder="https://github.com/yourname/project"
              icon={<GithubIcon />}
              value={projectForm.githubUrl}
              onChange={(e) =>
                setProjectForm({ ...projectForm, githubUrl: e.target.value })
              }
            />

            <Input
              id="proj-demo"
              label="Demo / Live URL"
              placeholder="https://your-demo.com"
              icon={<Globe size={16} />}
              value={projectForm.demoUrl}
              onChange={(e) =>
                setProjectForm({ ...projectForm, demoUrl: e.target.value })
              }
            />

            <Button type="submit" loading={submitting} className="w-full" size="lg">
              Submit Project
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
