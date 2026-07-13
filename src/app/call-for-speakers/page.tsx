"use client";

import { useState } from "react";
import { Mail, Upload, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";

type SessionType = "talk" | "workshop" | "panel" | "other";

interface FormData {
  cohortId: string;
  speakerName: string;
  speakerEmail: string;
  speakerBio: string;
  speakerPhotoUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  sessionTitle: string;
  sessionDescription: string;
  sessionTopic: string;
  recordingLink: string;
  additionalNotes: string;
  sessionType: SessionType;
}

const INITIAL_FORM: FormData = {
  cohortId: "cohort-sept-2026",
  speakerName: "",
  speakerEmail: "",
  speakerBio: "",
  speakerPhotoUrl: "",
  linkedinUrl: "",
  twitterUrl: "",
  sessionTitle: "",
  sessionDescription: "",
  sessionTopic: "",
  recordingLink: "",
  additionalNotes: "",
  sessionType: "talk",
};

export default function CallForSpeakersPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For now, we'll just store the filename
    // In production, upload to Firebase Storage and get the URL
    setForm((prev) => ({
      ...prev,
      speakerPhotoUrl: file.name,
    }));

    toast.success("Photo ready to upload (will be processed on submission)");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!form.speakerName || !form.speakerEmail || !form.sessionTitle) {
        toast.error("Please fill in all required fields");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/speaker-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to submit speaker call");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setSubmissionId(data.submissionId);
      toast.success(data.message);

      // Reset form after 3 seconds
      setTimeout(() => {
        setForm(INITIAL_FORM);
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Failed to submit speaker call");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Thank You!
            </h1>
            <p className="text-lg text-gray-700 mb-2">
              Your speaker submission has been received.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Submission ID: <code className="bg-gray-100 px-2 py-1 rounded">{submissionId}</code>
            </p>
            <p className="text-gray-700 mb-8">
              We'll review your submission and get back to you within 5-7 business days.
            </p>
            <Button
              onClick={() => {
                setSubmitted(false);
                setForm(INITIAL_FORM);
              }}
            >
              Submit Another Speaker Call
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Call for Speakers
          </h1>
          <p className="text-xl text-gray-700">
            Are you an expert in AI, agents, or related technologies? We'd love to have you speak at AI DevCamp!
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* Speaker Information */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Speaker Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="speakerName"
                  value={form.speakerName}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="speakerEmail"
                  value={form.speakerEmail}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Biography <span className="text-red-500">*</span>
              </label>
              <textarea
                name="speakerBio"
                value={form.speakerBio}
                onChange={handleChange}
                placeholder="Tell us about yourself (minimum 10 characters)"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Speaker Photo
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">JPG, PNG, max 5MB</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  LinkedIn
                </label>
                <input
                  type="url"
                  name="linkedinUrl"
                  value={form.linkedinUrl}
                  onChange={handleChange}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Twitter
                </label>
                <input
                  type="url"
                  name="twitterUrl"
                  value={form.twitterUrl}
                  onChange={handleChange}
                  placeholder="https://twitter.com/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Session Information */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              Session Information
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Session Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="sessionTitle"
                value={form.sessionTitle}
                onChange={handleChange}
                placeholder="What's your talk called?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="sessionDescription"
                value={form.sessionDescription}
                onChange={handleChange}
                placeholder="Describe your session in detail (minimum 20 characters)"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="sessionTopic"
                  value={form.sessionTopic}
                  onChange={handleChange}
                  placeholder="e.g., AI Agents, LLMs, Prompt Engineering"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Session Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="sessionType"
                  value={form.sessionType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="talk">Talk</option>
                  <option value="workshop">Workshop</option>
                  <option value="panel">Panel Discussion</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Recording Link
              </label>
              <input
                type="url"
                name="recordingLink"
                value={form.recordingLink}
                onChange={handleChange}
                placeholder="https://youtube.com/... or https://vimeo.com/..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Link to a recording of this talk (if available)</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                name="additionalNotes"
                value={form.additionalNotes}
                onChange={handleChange}
                placeholder="Any additional information (duration, special requirements, etc.)"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </section>

          {/* Hidden fields */}
          <input type="hidden" name="cohortId" value={form.cohortId} />

          {/* Submit */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Submit Speaker Call
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-gray-500 text-center mt-6">
            We'll review your submission and get back to you within 5-7 business days.
          </p>
        </form>

        {/* Info Box */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">What We're Looking For</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✨ Expertise in AI, machine learning, agents, or related technologies</li>
            <li>✨ Engaging speakers who can explain complex topics clearly</li>
            <li>✨ Practical, hands-on workshops or talks with code examples</li>
            <li>✨ Industry professionals and open-source contributors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
