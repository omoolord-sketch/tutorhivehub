import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Calculator,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FlaskConical,
  GraduationCap,
  Globe,
  Headphones,
  HeartHandshake,
  Laptop,
  LockKeyhole,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Microscope,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "./components/BrandLogo";
import { Field, SelectField, TextArea } from "./components/FormFields";
import { SectionHeading } from "./components/SectionHeading";
import { PublicNotFoundPage } from "./pages/PublicNotFoundPage";
import { PortalApp } from "./portal/PortalApp";

type IconComponent = LucideIcon;

type CardItem = {
  title: string;
  description: string;
  icon: IconComponent;
};

const navLinks = [
  { href: "#home", label: "Home" },
  { href: "#services", label: "Services" },
  { href: "#subjects", label: "Subjects" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#parents", label: "Parents" },
  { href: "#tutors", label: "Tutors" },
  { href: "#contact", label: "Contact" },
];

const benefits: CardItem[] = [
  {
    title: "Qualified Tutors",
    description: "Carefully selected tutors with strong subject knowledge and teaching experience.",
    icon: GraduationCap,
  },
  {
    title: "Flexible Online Lessons",
    description: "Learn from home with lesson times that fit the family schedule.",
    icon: Clock,
  },
  {
    title: "Personalised Learning",
    description: "Lessons tailored to each student's level, goals, and learning needs.",
    icon: Sparkles,
  },
  {
    title: "Exam-Focused Support",
    description: "Support for GCSE, A-Level, WAEC, JAMB, SAT, IELTS and more.",
    icon: Target,
  },
  {
    title: "Progress Support",
    description: "Regular feedback to help parents understand student improvement.",
    icon: ClipboardCheck,
  },
  {
    title: "Safe & Professional",
    description: "A trusted online learning environment with clear communication.",
    icon: ShieldCheck,
  },
];

const services: CardItem[] = [
  {
    title: "One-to-One Tutoring",
    description: "Personalised online lessons for students who need focused academic support.",
    icon: Users,
  },
  {
    title: "Homework Support",
    description: "Help students complete homework, understand topics, and build confidence.",
    icon: BookOpen,
  },
  {
    title: "Exam Preparation",
    description: "Structured preparation for GCSE, A-Level, WAEC, JAMB, SAT, IELTS, and school exams.",
    icon: Trophy,
  },
  {
    title: "NVQ Assignment Support",
    description: "Expert guidance for NVQ assignments, reports, and evidence-based tasks.",
    icon: ClipboardCheck,
  },
  {
    title: "Adult Education Support",
    description: "Flexible academic support for adult learners, returning students, and professional development pathways.",
    icon: GraduationCap,
  },
];

const subjects = [
  { label: "Mathematics", icon: Calculator },
  { label: "English", icon: BookOpen },
  { label: "Science", icon: FlaskConical },
  { label: "Biology", icon: Microscope },
  { label: "Chemistry", icon: FlaskConical },
  { label: "Physics", icon: Sparkles },
  { label: "Economics", icon: Target },
  { label: "Accounting", icon: Calculator },
  { label: "Business Studies", icon: BriefcaseBusiness },
  { label: "ICT & Computing", icon: Laptop },
  { label: "Further Mathematics", icon: Calculator },
  { label: "Exam Preparation", icon: ClipboardCheck },
  { label: "NVQ Assignment Support", icon: ClipboardCheck },
  { label: "Adult Education", icon: GraduationCap },
  { label: "And more", icon: ChevronRight },
];

const subjectNeededOptions = [
  "Mathematics",
  "English",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "Economics",
  "Accounting",
  "Business Studies",
  "ICT & Computing",
  "Further Mathematics",
  "Exam Preparation",
  "NVQ Assignment Support",
  "Adult Education",
  "University Admissions",
  "Other / Not Sure Yet",
];

const examPathways = ["GCSE", "A-Level", "WAEC", "JAMB", "SAT", "IELTS", "School Exams", "University Admissions"];

const heroStats = [
  { label: "Students Supported", value: "25+" },
  { label: "Qualified Tutors", value: "10+" },
  { label: "Core Subjects", value: "12+" },
  { label: "Learning Format", value: "100% Online" },
];

const steps = [
  {
    title: "Book Free Assessment",
    description: "Parents submit student details and academic needs.",
  },
  {
    title: "Academic Review",
    description: "TutorHiveHub reviews the student's level, goals, and subject requirements.",
  },
  {
    title: "Tutor Matching",
    description: "The student is matched with a suitable online tutor.",
  },
  {
    title: "Start Learning",
    description: "Lessons begin online with ongoing support and progress feedback.",
  },
];

const safetyItems: CardItem[] = [
  {
    title: "Tutor Review Process",
    description: "Tutors are reviewed for subject knowledge, communication, professionalism, and reliability.",
    icon: ShieldCheck,
  },
  {
    title: "Parent Communication",
    description: "Parents are kept informed about student support, lesson progress, and next steps.",
    icon: Headphones,
  },
  {
    title: "Professional Online Lessons",
    description: "Lessons are delivered online in a structured and respectful learning environment.",
    icon: Laptop,
  },
  {
    title: "Student Wellbeing",
    description: "TutorHiveHub prioritises confidence, clarity, and student wellbeing alongside academic progress.",
    icon: HeartHandshake,
  },
];

const tutorProfiles = [
  {
    name: "Bukola E. Olowoeyo",
    initials: "BO",
    photo: "/tutor-bukola-esther.png",
    photoPosition: "50% 18%",
    subject: "Chemistry & Pharmaceutical Chemistry",
    qualification: "B.Sc, M.Sc, PhD Pharmaceutical Chemistry",
    focus: "GCSE and A-Level support",
  },
  {
    name: "Samuel M. Kolawole",
    initials: "SK",
    photo: "/tutor-samuel-kolawole.png",
    photoPosition: "50% 18%",
    subject: "Mathematics & Further Mathematics",
    qualification: "BSc Industrial Mathematics",
    focus: "Exam preparation and problem-solving skills",
  },
  {
    name: "Olabisi Aladejebi",
    initials: "AO",
    photo: "/tutor-olabisi-aladejebi.png",
    photoPosition: "50% 15%",
    subject: "English & IELTS",
    qualification: "BA English",
    focus: "English language, writing, and IELTS preparation",
  },
  {
    name: "Taye A. Olowoeyo",
    initials: "TO",
    photo: "/tutor-taye-olowoeyo.png",
    photoPosition: "50% 15%",
    subject: "Business & Economics",
    qualification: "BSc Economics",
    focus: "GCSE, A-Level, and business studies support",
  },
];

const testimonials = [
  {
    quote:
      "TutorHiveHub helped my child gain confidence in Mathematics. The online lessons are structured, clear, and professional.",
    name: "Parent of Year 9 Student",
  },
  {
    quote:
      "The tutor explained difficult topics clearly and kept us updated after lessons. It felt organised from day one.",
    name: "GCSE Parent",
  },
  {
    quote:
      "TutorHiveHub gave our son a focused revision plan and the confidence to approach his exams calmly.",
    name: "A-Level Parent",
  },
];

const supportTypes = [
  "One-to-One Tutoring",
  "Homework Support",
  "GCSE Preparation",
  "A-Level Preparation",
  "SAT Preparation",
  "IELTS Preparation",
  "WAEC Preparation",
  "JAMB Preparation",
  "NVQ Assignment Support",
  "Adult Education Support",
  "University Admissions Coaching",
  "Combined Tutoring & Homework Support",
  "Not Sure Yet",
];

const primaryTeachingDeviceOptions = ["Desktop Computer", "Laptop", "Chromebook", "Tablet (Not Preferred)", "Other"];
const operatingSystemOptions = ["Windows 11", "Windows 10", "macOS", "ChromeOS", "Linux", "Other"];
const internetConnectionOptions = ["Fibre Broadband (Preferred)", "Home Wi-Fi (Broadband)", "4G Mobile Data", "5G Mobile Data", "Satellite Internet", "Other"];
const averageInternetSpeedOptions = ["Less than 10 Mbps", "10-25 Mbps", "25-50 Mbps", "50-100 Mbps", "Over 100 Mbps", "Not Sure"];
const yesNoOptions = ["Yes", "No"];
const onlineTeachingPlatformOptions = ["Zoom", "Google Meet", "Microsoft Teams", "Skype", "Other"];
const timeZoneOptions = ["United Kingdom (GMT/BST)", "Nigeria (WAT)", "Other"];

const faqs = [
  {
    question: "Are lessons online?",
    answer: "Yes. TutorHiveHub lessons are delivered online, so students can learn from home with flexible scheduling.",
  },
  {
    question: "What age groups do you support?",
    answer: "TutorHiveHub supports students aged 5+ across primary, secondary, exam, and admissions stages.",
  },
  {
    question: "Which exams do you prepare students for?",
    answer: "Support is available for GCSE, A-Level, WAEC, JAMB, SAT, IELTS, school exams, and related assessments.",
  },
  {
    question: "How are tutors selected?",
    answer: "Tutors are reviewed for subject knowledge, communication, experience, professionalism, and availability.",
  },
  {
    question: "How do parents get started?",
    answer: "Parents can request a free academic assessment and TutorHiveHub will recommend the right next step.",
  },
];

const whatsappHref =
  "https://wa.me/447478412656?text=Hello%20TutorHiveHub%2C%20I%20would%20like%20to%20book%20a%20free%20academic%20assessment.";
const publicInfoEmail = "info@tutorhivehub.com";
const adminEmail = "admin@tutorhivehub.com";
const formEndpoints = {
  parent: "/api/parent-enquiry",
  tutor: "/api/tutor-application",
};
const productionPortalLoginHref = "https://portal.tutorhivehub.com/portal/login";
type FormName = keyof typeof formEndpoints;
type FormStatus = "idle" | "submitting" | "success" | "error";

function App() {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";

  if (currentPath.startsWith("/portal")) {
    return <PortalApp currentPath={currentPath} />;
  }

  if (currentPath !== "/") {
    return <PublicNotFoundPage />;
  }

  return <LandingPage />;
}

function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [parentStatus, setParentStatus] = useState<FormStatus>("idle");
  const [tutorStatus, setTutorStatus] = useState<FormStatus>("idle");
  const [parentError, setParentError] = useState("");
  const [tutorError, setTutorError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>, formName: FormName) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const setStatus = formName === "parent" ? setParentStatus : setTutorStatus;
    const setError = formName === "parent" ? setParentError : setTutorError;

    setStatus("submitting");
    setError("");

    if (formName === "parent") {
      const selectedSubjects = data.getAll("subjectNeeded[]").filter((value) => String(value).trim() !== "");
      if (selectedSubjects.length === 0 || selectedSubjects.length > 4) {
        setStatus("error");
        setError("Please select between 1 and 4 subjects or areas of help.");
        return;
      }
    }

    if (formName === "tutor") {
      const hasOnlineTeachingExperience = String(data.get("previousOnlineTeachingExperience") ?? "");
      const selectedPlatforms = data.getAll("onlineTeachingPlatforms[]").filter((value) => String(value).trim() !== "");
      if (hasOnlineTeachingExperience === "Yes" && selectedPlatforms.length === 0) {
        setStatus("error");
        setError("Please select at least one online teaching platform you have used.");
        return;
      }
    }

    try {
      const response = await fetch(formEndpoints[formName], {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message ?? "TutorHiveHub could not send this submission. Please email us directly.");
      }

      form.reset();
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setError(error instanceof Error ? error.message : "TutorHiveHub could not send this submission. Please email us directly.");
    }
  }

  return (
    <div className="min-h-screen bg-white pb-28 text-ink lg:pb-0">
      <Header isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
      <main>
        <Hero />
        <Benefits />
        <Testimonials />
        <Services />
        <Subjects />
        <HowItWorks />
        <Safeguarding />
        <TutorPreview />
        <ParentsForm onSubmit={handleSubmit} status={parentStatus} error={parentError} />
        <TutorsForm onSubmit={handleSubmit} status={tutorStatus} error={tutorError} />
        <AssessmentCta />
        <Faqs />
        <Contact />
      </main>
      <Footer />
      <MobileStickyCta />
      <a
        href={whatsappHref}
        className="fixed bottom-5 right-5 z-50 hidden h-14 w-14 items-center justify-center rounded-lg bg-[#16A34A] text-white shadow-soft transition hover:-translate-y-1 hover:bg-[#15803D] focus:outline-none focus:ring-4 focus:ring-[#16A34A]/30 lg:inline-flex"
        aria-label="WhatsApp TutorHiveHub"
      >
        <MessageCircle className="h-7 w-7" aria-hidden="true" />
      </a>
    </div>
  );
}

function Header({
  isMenuOpen,
  setIsMenuOpen,
}: {
  isMenuOpen: boolean;
  setIsMenuOpen: (value: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <a href="#home" aria-label="TutorHiveHub home" onClick={() => setIsMenuOpen(false)}>
          <BrandLogo />
        </a>
        <div className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-bold text-slate-700 transition hover:text-gold">
              {link.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <PortalLoginLink />
          <PrimaryLink href="#parents" label="Book Free Assessment" icon={CalendarCheck} />
        </div>
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-navy lg:hidden"
          aria-controls="mobile-menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="sr-only">Open main menu</span>
          {isMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </nav>
      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-slate-200 bg-white px-4 py-4 shadow-soft lg:hidden">
          <div className="grid gap-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-3 text-base font-bold text-navy hover:bg-gold-50"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href={getPortalLoginHref()}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:border-gold hover:bg-gold-50"
              onClick={() => setIsMenuOpen(false)}
            >
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              Portal Login
            </a>
            <a
              href="#parents"
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-black text-navy shadow-sm transition hover:bg-gold-100"
              onClick={() => setIsMenuOpen(false)}
            >
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Book Free Assessment
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function getPortalLoginHref() {
  if (typeof window === "undefined") {
    return productionPortalLoginHref;
  }

  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "portal.tutorhivehub.com") {
    return "/portal/login";
  }

  return productionPortalLoginHref;
}

function Hero() {
  return (
    <section id="home" className="relative isolate overflow-hidden bg-navy text-white">
      <div className="absolute inset-0 bg-[url('/tutorhivehub-hero.png')] bg-cover bg-[70%_top] opacity-35" aria-hidden="true" />
      <div className="hero-overlay absolute inset-0" aria-hidden="true" />
      <div className="hero-shell relative mx-auto flex max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-8 flex max-w-[22rem] items-start gap-3 text-sm font-bold text-gold sm:max-w-none">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Trusted online academic support for students aged 5+</span>
          </div>
          <h1 className="max-w-[22rem] text-3xl font-black leading-tight text-white sm:max-w-3xl sm:text-5xl lg:text-6xl">
            Expert Online Tutoring for GCSE, A-Level, SAT, IELTS, WAEC & JAMB
          </h1>
          <p className="mt-6 max-w-[22rem] text-lg leading-8 text-white/85 sm:max-w-2xl sm:text-xl">
            Personalised one-to-one tutoring, homework support, exam preparation, and university admissions coaching for students aged 5+.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <PrimaryLink href="#parents" label="Book Free Assessment" icon={CalendarCheck} />
            <SecondaryLink href="#tutors" label="Become a Tutor" icon={GraduationCap} />
          </div>
          <dl className="mt-12 grid max-w-[22rem] grid-cols-2 gap-3 text-white sm:max-w-3xl sm:grid-cols-4">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
                <dt className="text-xs font-bold uppercase text-white/65">{stat.label}</dt>
                <dd className="mt-2 text-xl font-black text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="benefits-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Why TutorHiveHub"
          title="Academic support built around trust, clarity, and progress"
          description="Parents get clear communication, students get focused online lessons, and every plan starts with understanding the learner first."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => (
            <InfoCard key={benefit.title} item={benefit} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="services-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Services"
          title="Focused online academic support for the moments that matter"
          description="TutorHiveHub keeps the offer clear: tutoring, homework help, exam preparation, and admissions coaching."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-4">
          {services.map((service) => (
            <article key={service.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
              <service.icon className="h-10 w-10 text-gold" aria-hidden="true" />
              <h3 className="mt-6 text-xl font-black text-navy">{service.title}</h3>
              <p className="mt-4 leading-7 text-slate-650">{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Subjects() {
  return (
    <section id="subjects" className="bg-white px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="subjects-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Subjects"
          title="Core subjects, exam pathways, and specialist support"
          description="A broad subject range lets families request the right support from primary foundations through advanced exam preparation."
          align="center"
        />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {subjects.map((subject) => (
            <div key={subject.label} className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <subject.icon className="mx-auto h-8 w-8 text-navy" aria-hidden="true" />
              <p className="mt-3 text-sm font-black text-navy">{subject.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-lg border border-gold/25 bg-gold-50 p-5">
          <p className="text-sm font-black uppercase text-navy">Exam Pathways</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {examPathways.map((pathway) => (
              <span key={pathway} className="rounded-md bg-white px-4 py-2 text-sm font-black text-navy shadow-sm">
                {pathway}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-navy px-4 py-20 text-white sm:px-6 lg:px-8" aria-labelledby="how-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="How It Works"
          title="A simple route from enquiry to confident learning"
          description="TutorHiveHub keeps the process parent-friendly and transparent from the first conversation."
          tone="dark"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-lg border border-white/15 bg-white/8 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold text-lg font-black text-navy">
                {index + 1}
              </div>
              <h3 className="mt-6 text-xl font-black text-white">{step.title}</h3>
              <p className="mt-4 leading-7 text-white/75">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Safeguarding() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="safeguarding-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Student Safety"
          title="Safeguarding & Student Safety"
          description="TutorHiveHub is committed to creating a safe, respectful, and professional online learning environment for every student."
          align="center"
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {safetyItems.map((item) => (
            <InfoCard key={item.title} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TutorPreview() {
  return (
    <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="tutor-preview-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Tutor Team"
          title="Meet Some of Our Tutors"
          description="TutorHiveHub works with knowledgeable tutors across core academic subjects, exams, and specialist study pathways."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {tutorProfiles.map((profile) => (
            <article key={profile.name} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="h-56 overflow-hidden border-b border-slate-200 bg-gold-50">
                <img
                  src={profile.photo}
                  alt={`${profile.name} profile photo`}
                  loading="eager"
                  decoding="async"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: profile.photoPosition }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-black text-navy">{profile.name}</h3>
                <p className="mt-2 font-bold text-gold">{profile.subject}</p>
                <p className="mt-4 text-sm font-bold text-slate-500">{profile.qualification}</p>
                <p className="mt-3 leading-7 text-slate-650">{profile.focus}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ParentsForm({
  onSubmit,
  status,
  error,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>, formName: FormName) => void;
  status: FormStatus;
  error: string;
}) {
  const isSubmitting = status === "submitting";

  return (
    <section id="parents" className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="parents-title">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <SectionHeading
            eyebrow="For Parents"
            title="Request academic support for your child"
            description="Share the student's needs and TutorHiveHub will contact you shortly to discuss the best support route."
          />
          <ul className="mt-8 space-y-4">
            {["Free academic assessment first", "Flexible online lesson options", "Clear communication with families"].map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-700">
                <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
                <span className="font-semibold">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-8" onSubmit={(event) => onSubmit(event, "parent")}>
          <div className="grid gap-5 md:grid-cols-2">
            <Field id="parentName" label="Parent full name" type="text" autoComplete="name" required />
            <Field id="parentEmail" label="Email address" type="email" autoComplete="email" required />
            <Field id="parentPhone" label="Phone number" type="tel" autoComplete="tel" required />
            <Field id="parentCountry" label="Country" type="text" autoComplete="country-name" required />
            <Field id="studentName" label="Student name" type="text" required />
            <Field id="studentAge" label="Student age" type="number" min="5" max="25" required />
            <Field id="schoolYear" label="School year / class" type="text" required />
            <SubjectChoiceGroup options={subjectNeededOptions} />
            <SelectField id="preferredSupportType" label="Preferred support type" options={supportTypes} required />
            <Field id="startDate" label="Start date" type="date" required />
            <Field id="totalIntendedHours" label="Total intended hours per child" type="number" min="1" step="1" required />
            <TextArea id="academicGoal" label="Academic goal / message" className="md:col-span-2" required />
          </div>
          {status === "success" && (
            <p className="mt-5 rounded-md border border-[#16A34A]/25 bg-[#ECFDF3] px-4 py-3 text-sm font-bold text-[#166534]">
              Thank you. TutorHiveHub has received your request and will contact you shortly.
            </p>
          )}
          {status === "error" && (
            <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error || `Sorry, this form could not be sent. Please email ${publicInfoEmail} directly.`}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold px-6 py-4 text-base font-black text-navy shadow-sm transition hover:bg-gold-100 focus:outline-none focus:ring-4 focus:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
          >
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            {isSubmitting ? "Sending request..." : "Request Academic Support"}
          </button>
        </form>
      </div>
    </section>
  );
}

function SubjectChoiceGroup({ options }: { options: string[] }) {
  return (
    <fieldset className="md:col-span-2">
      <legend className="text-sm font-bold text-navy">Subject / area of help needed</legend>
      <p className="mt-1 text-sm text-slate-600">Choose up to four subjects, especially for one-to-one tutoring.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const id = `subjectNeeded-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

          return (
            <label
              key={option}
              htmlFor={id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-navy shadow-sm transition hover:border-gold hover:bg-gold-50"
            >
              <input
                id={id}
                name="subjectNeeded[]"
                type="checkbox"
                value={option}
                className="h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold"
              />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function MultiChoiceGroup({ legend, name, options, className = "" }: { legend: string; name: string; options: string[]; className?: string }) {
  return (
    <fieldset className={className}>
      <legend className="text-sm font-bold text-navy">{legend}</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const id = `${name.replace(/\[\]/g, "")}-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

          return (
            <label
              key={option}
              htmlFor={id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-navy shadow-sm transition hover:border-gold hover:bg-gold-50"
            >
              <input id={id} name={name} type="checkbox" value={option} className="h-4 w-4 rounded border-slate-300 text-gold focus:ring-gold" />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function TutorsForm({
  onSubmit,
  status,
  error,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>, formName: FormName) => void;
  status: FormStatus;
  error: string;
}) {
  const isSubmitting = status === "submitting";
  const [previousOnlineTeachingExperience, setPreviousOnlineTeachingExperience] = useState("");

  useEffect(() => {
    if (status === "success") {
      setPreviousOnlineTeachingExperience("");
    }
  }, [status]);

  return (
    <section id="tutors" className="bg-white px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="tutors-title">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-start">
        <div>
          <SectionHeading
            eyebrow="For Tutors"
            title="Apply to join TutorHiveHub's online tutor team"
            description="TutorHiveHub welcomes tutors who are knowledgeable, reliable, patient, and committed to professional online teaching."
          />
          <form className="mt-10 rounded-lg border border-slate-200 bg-white p-5 shadow-soft sm:p-8" onSubmit={(event) => onSubmit(event, "tutor")}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field id="tutorName" label="Full name" type="text" autoComplete="name" required />
              <Field id="tutorEmail" label="Email address" type="email" autoComplete="email" required />
              <Field id="tutorPhone" label="Phone number" type="tel" autoComplete="tel" required />
              <Field id="tutorCountry" label="Country" type="text" autoComplete="country-name" required />
              <Field id="subjectsCanTeach" label="Subjects you can teach" type="text" required />
              <Field id="highestQualification" label="Highest qualification" type="text" required />
              <Field id="teachingExperience" label="Teaching / tutoring experience" type="text" required />
              <fieldset className="md:col-span-2">
                <legend className="text-sm font-bold text-navy">Technical Readiness</legend>
                <p className="mt-1 text-sm text-slate-600">
                  Tutors are expected to use a desktop, laptop, or Chromebook as their primary teaching device. Mobile phones are not accepted as the primary
                  teaching device.
                </p>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <SelectField id="primaryTeachingDevice" label="Primary Teaching Device" options={primaryTeachingDeviceOptions} required />
                  <SelectField id="operatingSystem" label="Operating System" options={operatingSystemOptions} required />
                  <SelectField id="internetConnectionType" label="Internet Connection Type" options={internetConnectionOptions} required />
                  <SelectField id="averageInternetSpeed" label="Average Internet Speed" options={averageInternetSpeedOptions} required />
                  <SelectField id="backupInternetAvailable" label="Backup Internet Available?" options={yesNoOptions} required />
                  <SelectField id="webcamAvailable" label="Webcam Available?" options={yesNoOptions} required />
                  <SelectField id="headsetWithMicrophoneAvailable" label="Headset with Microphone Available?" options={yesNoOptions} required />
                  <SelectField id="quietTeachingEnvironment" label="Quiet Teaching Environment?" options={yesNoOptions} required />
                  <SelectField
                    id="previousOnlineTeachingExperience"
                    label="Previous Online Teaching Experience?"
                    options={yesNoOptions}
                    required
                    value={previousOnlineTeachingExperience}
                    onChange={(event) => setPreviousOnlineTeachingExperience(event.currentTarget.value)}
                  />
                  <SelectField id="timeZone" label="Time Zone" options={timeZoneOptions} required />
                  {previousOnlineTeachingExperience === "Yes" && (
                    <MultiChoiceGroup
                      legend="Online teaching platforms used"
                      name="onlineTeachingPlatforms[]"
                      options={onlineTeachingPlatformOptions}
                      className="md:col-span-2"
                    />
                  )}
                </div>
              </fieldset>
              <Field id="availability" label="Availability" type="text" required />
              <Field id="cvUpload" label="CV upload" type="file" accept=".pdf,.doc,.docx" />
              <TextArea id="tutorMessage" label="Short message" className="md:col-span-2" required />
            </div>
            {status === "success" && (
              <p className="mt-5 rounded-md border border-[#16A34A]/25 bg-[#ECFDF3] px-4 py-3 text-sm font-bold text-[#166534]">
                Thank you. Your tutor application has been received. TutorHiveHub will review it and contact you soon.
              </p>
            )}
            {status === "error" && (
              <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error || `Sorry, this application could not be sent. Please email ${adminEmail} directly.`}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-6 py-4 text-base font-black text-white shadow-sm transition hover:bg-navy-700 focus:outline-none focus:ring-4 focus:ring-navy/25 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
              {isSubmitting ? "Sending application..." : "Apply as Tutor"}
            </button>
          </form>
        </div>
        <aside className="rounded-lg bg-navy p-4 shadow-soft">
          <img
            src="/tutorhivehub-tutor-recruitment.png"
            alt="TutorHiveHub tutor recruitment flyer with online tutor branding"
            className="aspect-[4/5] w-full rounded-md object-cover object-top"
          />
          <div className="mt-5 grid gap-4 text-white sm:grid-cols-2 lg:grid-cols-1">
            {["Inspire students", "Teach online", "Build academic confidence"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-gold" aria-hidden="true" />
                <span className="font-bold">{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="testimonials-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Testimonials"
          title="What Parents Say About TutorHiveHub"
          description="Real parent feedback helps families understand the care, structure, and academic support TutorHiveHub provides."
          align="center"
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <article key={testimonial.name} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex gap-1 text-gold" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((item) => (
                  <Star key={item} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-5 leading-8 text-slate-700">"{testimonial.quote}"</blockquote>
              <p className="mt-6 font-black text-navy">{testimonial.name}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssessmentCta() {
  return (
    <section className="bg-navy px-4 py-20 text-white sm:px-6 lg:px-8" aria-labelledby="assessment-title">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase text-gold">Free Academic Assessment</p>
          <h2 id="assessment-title" className="mt-3 max-w-3xl text-3xl font-black sm:text-4xl">
            Personalised tutoring plans available after a free academic assessment.
          </h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">
            Every student is different. TutorHiveHub recommends the right support plan after understanding the student's academic needs.
          </p>
        </div>
        <PrimaryLink href="#parents" label="Book Free Assessment" icon={CalendarCheck} />
      </div>
    </section>
  );
}

function Faqs() {
  return (
    <section className="bg-white px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="faq-title">
      <div className="mx-auto max-w-4xl">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions parents often ask"
          description="A quick overview of the essentials before booking an assessment."
          align="center"
        />
        <div className="mt-10 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {faqs.map((faq) => (
            <details key={faq.question} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-black text-navy">
                {faq.question}
                <ChevronRight className="h-5 w-5 shrink-0 transition group-open:rotate-90" aria-hidden="true" />
              </summary>
              <p className="mt-4 leading-7 text-slate-650">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="bg-slate-50 px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="contact-title">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Contact"
          title="Speak with TutorHiveHub"
          description="Parents and tutors can contact TutorHiveHub by email, phone, or WhatsApp."
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-5">
              <ContactRow icon={Mail} label="Email" value={publicInfoEmail} href={`mailto:${publicInfoEmail}`} />
              <ContactRow icon={Globe} label="Website" value="tutorhivehub.com" href="https://tutorhivehub.com/" />
              <ContactRow icon={Phone} label="UK phone" value="+44 7478 412656" href="tel:+447478412656" />
              <ContactRow icon={Phone} label="Nigeria phone" value="+234 903 356 3048" href="tel:+2349033563048" />
              <ContactRow icon={Clock} label="Business hours" value="Monday to Saturday, 9:00am - 8:00pm UK Time" />
              <ContactRow icon={MapPin} label="Learning format" value="Online tutoring worldwide" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <ContactButton href={`mailto:${publicInfoEmail}`} icon={Mail} label="Email TutorHiveHub" />
            <ContactButton href={whatsappHref} icon={MessageCircle} label="WhatsApp TutorHiveHub" />
            <ContactButton href="tel:+447478412656" icon={Phone} label="Call TutorHiveHub" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const year = new Date().getFullYear();
  const legalLinks = [
    { label: "Privacy Policy", href: "/privacy-policy.html" },
    { label: "Safeguarding Policy", href: "/safeguarding-policy.html" },
    { label: "Terms & Conditions", href: "/terms-and-conditions.html" },
    { label: "Cookie Policy", href: "/cookie-policy.html" },
  ];

  return (
    <footer className="bg-navy-900 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div>
          <BrandLogo light />
          <p className="mt-5 max-w-sm text-sm leading-7 text-white/65">
            Professional online academic support for students, parents, and tutors.
          </p>
        </div>
        <FooterColumn title="Quick Links">
          {navLinks.slice(1).map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-gold">
              {link.label}
            </a>
          ))}
        </FooterColumn>
        <FooterColumn title="Legal">
          {legalLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-gold">
              {link.label}
            </a>
          ))}
        </FooterColumn>
        <FooterColumn title="Contact">
          <a href={`mailto:${publicInfoEmail}`} className="transition hover:text-gold">
            {publicInfoEmail}
          </a>
          <a href="https://tutorhivehub.com/" className="transition hover:text-gold">
            tutorhivehub.com
          </a>
          <a href="tel:+447478412656" className="transition hover:text-gold">
            +44 7478 412656
          </a>
          <span>Monday to Saturday</span>
          <span>9:00am - 8:00pm UK Time</span>
        </FooterColumn>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright {year} TutorHiveHub. All rights reserved.</p>
        <p>Your Hub for Academic Success</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-black uppercase text-gold">{title}</h3>
      <div className="mt-4 grid gap-3 text-sm text-white/70">
        {children}
      </div>
    </div>
  );
}

function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-12px_30px_rgba(6,28,61,0.12)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg gap-3">
        <a
          href="#parents"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-black text-navy shadow-sm focus:outline-none focus:ring-4 focus:ring-gold/30"
        >
          <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          Book Free Assessment
        </a>
        <a
          href={whatsappHref}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#16A34A] text-white focus:outline-none focus:ring-4 focus:ring-[#16A34A]/30"
          aria-label="WhatsApp TutorHiveHub"
        >
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function InfoCard({ item }: { item: CardItem }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold-50 text-navy">
        <item.icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-6 text-xl font-black text-navy">{item.title}</h3>
      <p className="mt-4 leading-7 text-slate-650">{item.description}</p>
    </article>
  );
}

function PortalLoginLink() {
  return (
    <a
      href={getPortalLoginHref()}
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-navy shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:bg-gold-50 focus:outline-none focus:ring-4 focus:ring-gold/20 sm:w-auto"
    >
      <LockKeyhole className="h-5 w-5" aria-hidden="true" />
      Portal Login
    </a>
  );
}

function PrimaryLink({ href, label, icon: Icon }: { href: string; label: string; icon: IconComponent }) {
  return (
    <a
      href={href}
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-md bg-gold px-6 py-3 text-center text-sm font-black text-navy shadow-sm transition hover:-translate-y-0.5 hover:bg-gold-100 focus:outline-none focus:ring-4 focus:ring-gold/30 sm:w-auto"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  );
}

function SecondaryLink({ href, label, icon: Icon }: { href: string; label: string; icon: IconComponent }) {
  return (
    <a
      href={href}
      className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/25 sm:w-auto"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </a>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="mt-1 block text-lg font-black text-navy">{value}</span>
    </>
  );

  return (
    <div className="flex gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gold-50 text-navy">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      {href ? (
        <a href={href} className="min-w-0 transition hover:text-gold">
          {content}
        </a>
      ) : (
        <div className="min-w-0">{content}</div>
      )}
    </div>
  );
}

function ContactButton({ href, icon: Icon, label }: { href: string; icon: IconComponent; label: string }) {
  return (
    <a
      href={href}
      className="flex min-h-40 flex-col justify-between rounded-lg border border-slate-200 bg-white p-6 text-navy shadow-sm transition hover:-translate-y-1 hover:border-gold hover:shadow-soft focus:outline-none focus:ring-4 focus:ring-gold/20"
    >
      <Icon className="h-9 w-9 text-gold" aria-hidden="true" />
      <span className="mt-8 text-xl font-black">{label}</span>
    </a>
  );
}

export default App;
