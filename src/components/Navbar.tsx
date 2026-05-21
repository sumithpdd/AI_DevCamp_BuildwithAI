"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { logout } from "@/lib/auth";
import AuthModal from "./AuthModal";
import {
  LogOut,
  User,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  BookOpen,
  Upload,
  Shield,
  ClipboardList,
  UsersRound,
  Award,
} from "lucide-react";
import { isRegistrationOpen } from "@/lib/registrationOpen";
import { certifierCredentialViewUrl } from "@/lib/certifierLinks";
import toast from "react-hot-toast";
import ProgramOptOutControl from "@/components/ProgramOptOutControl";

export default function Navbar() {
  const { user, userProfile, loading } = useAuth();
  const [authModal, setAuthModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out successfully");
    setDropdownOpen(false);
  };

  const certUrl =
    userProfile?.userStatus === "certified" && userProfile.certifierCredentialPublicId
      ? certifierCredentialViewUrl(userProfile.certifierCredentialPublicId)
      : userProfile?.userStatus === "certified"
        ? "/profile#certificate"
        : null;

  const navLinks = [
    { href: "/sessions", label: "Sessions", icon: BookOpen },
    ...(user ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] : []),
    ...(certUrl
      ? [{ href: certUrl, label: "Certificate", icon: Award, external: certUrl.startsWith("http") }]
      : []),
    ...(user ? [{ href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList }] : []),
    ...(user ? [{ href: "/submit", label: "Submit", icon: Upload }] : []),
    ...(user ? [{ href: "/buddies", label: "Buddies", icon: UsersRound }] : []),
    ...(userProfile?.role === "admin"
      ? [{ href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="AI DevCamp"
                width={44}
                height={44}
                className="rounded-xl"
              />
              <span className="font-bold text-white text-base leading-tight font-mono">
                AI_DEVCAMP
                <span className="block text-xs text-green-400 font-normal tracking-wider">
                  Build with AI
                </span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, external }) =>
                external ? (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300/90 hover:text-emerald-200 hover:bg-emerald-500/10 px-4 py-2 rounded-lg text-sm font-medium transition-all font-mono"
                  >
                    {label}
                  </a>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    className="text-gray-300 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  >
                    {label}
                  </Link>
                )
              )}
            </div>

            <div className="flex items-center gap-3">
              {!loading && (
                <>
                  {user ? (
                    <div className="relative">
                      <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-all"
                      >
                        {user.photoURL ? (
                          <Image
                            src={user.photoURL}
                            alt="Avatar"
                            width={28}
                            height={28}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xs font-bold">
                            {(userProfile?.displayName ||
                              user.email ||
                              "U")[0].toUpperCase()}
                          </div>
                        )}
                        <span className="hidden sm:block text-sm text-white font-medium max-w-[120px] truncate">
                          {userProfile?.displayName || user.email}
                        </span>
                        <ChevronDown size={14} className="text-gray-400" />
                      </button>

                      {dropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setDropdownOpen(false)}
                          />
                          <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-white/10 rounded-xl shadow-2xl py-2 z-20">
                            <div className="px-4 py-2 border-b border-white/10">
                              <p className="text-sm font-medium text-white truncate">
                                {userProfile?.displayName}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {user.email}
                              </p>
                              {userProfile?.role && userProfile.role !== "attendee" && (
                                <span className="inline-block mt-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full capitalize">
                                  {userProfile.role}
                                </span>
                              )}
                            </div>
                            <Link
                              href="/dashboard"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <LayoutDashboard size={16} />
                              Dashboard
                            </Link>
                            <Link
                              href="/dashboard/tasks"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <ClipboardList size={16} />
                              Learning tasks
                            </Link>
                            <Link
                              href="/profile"
                              onClick={() => setDropdownOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <User size={16} />
                              My Profile
                            </Link>
                            {userProfile?.userStatus === "certified" && (
                              <Link
                                href={
                                  userProfile.certifierCredentialPublicId
                                    ? certifierCredentialViewUrl(userProfile.certifierCredentialPublicId)
                                    : "/profile#certificate"
                                }
                                target={
                                  userProfile.certifierCredentialPublicId ? "_blank" : undefined
                                }
                                rel={
                                  userProfile.certifierCredentialPublicId
                                    ? "noopener noreferrer"
                                    : undefined
                                }
                                onClick={() => setDropdownOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 transition-colors"
                              >
                                <Award size={16} />
                                {userProfile.certifierCredentialPublicId
                                  ? "View certificate"
                                  : "Get certificate"}
                              </Link>
                            )}
                            {userProfile?.role === "admin" && (
                              <Link
                                href="/admin"
                                onClick={() => setDropdownOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <Shield size={16} />
                                Admin Panel
                              </Link>
                            )}
                            <div className="border-t border-white/10 mt-1 pt-1">
                              <ProgramOptOutControl
                                variant="menu"
                                onAfterChange={() => setDropdownOpen(false)}
                              />
                            </div>
                            <div className="border-t border-white/10 mt-1 pt-1">
                              <button
                                onClick={handleLogout}
                                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                              >
                                <LogOut size={16} />
                                Sign Out
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="hidden md:flex items-center gap-2">
                      <button
                        onClick={() => setAuthModal(true)}
                        className="text-gray-300 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/5 transition-all font-mono"
                      >
                        Sign In
                      </button>
                      {isRegistrationOpen() && (
                        <Link
                          href="/register"
                          className="bg-green-500 hover:bg-green-400 text-gray-950 text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-lg font-mono"
                        >
                          Register
                        </Link>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="md:hidden text-gray-300 hover:text-white p-2"
                  >
                    {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-gray-950 border-t border-white/10 px-4 py-4 space-y-1">
            {navLinks.map(({ href, label, icon: Icon, external }) =>
              external ? (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 px-4 py-3 rounded-lg text-sm font-medium transition-all"
                >
                  <Icon size={16} />
                  {label}
                </a>
              ) : (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 text-gray-300 hover:text-white hover:bg-white/5 px-4 py-3 rounded-lg text-sm font-medium transition-all"
                >
                  <Icon size={16} />
                  {label}
                </Link>
              )
            )}
            {user && (
              <div className="pt-3 border-t border-white/10 mt-2">
                <ProgramOptOutControl
                  variant="menu"
                  onAfterChange={() => setMobileMenuOpen(false)}
                />
              </div>
            )}
            {!user && (
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModal(true);
                  }}
                  className="w-full text-center text-gray-300 hover:text-white border border-white/10 px-4 py-2.5 rounded-lg text-sm font-medium transition-all font-mono"
                >
                  Sign In
                </button>
                {isRegistrationOpen() && (
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center bg-green-500 hover:bg-green-400 text-gray-950 px-4 py-2.5 rounded-lg text-sm font-bold transition-all font-mono"
                  >
                    Register
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <AuthModal isOpen={authModal} onClose={() => setAuthModal(false)} />
    </>
  );
}
