import { vi } from "vitest";

export const mockJobAnalysisResponse = {
  title: "Senior Software Engineer",
  company: "Publicis Groupe",
  location: "New York, NY (Hybrid)",
  salary: "$140,000 - $180,000",
  jobType: "Full-time",
  remote: true,
  requiredSkills: [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "Python",
    "AWS",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "MongoDB",
    "GraphQL",
    "REST APIs",
  ],
  preferredSkills: [
    "Java",
    "Spring Boot",
    "Kafka",
    "Redis",
    "GCP",
    "Terraform",
    "CI/CD",
    "Agile",
  ],
  requiredYearsExperience: 5,
  educationRequired: "Bachelor's degree in Computer Science or related field",
  responsibilities: [
    "Design and implement scalable microservices architecture",
    "Lead technical design discussions and code reviews",
    "Mentor junior engineers and drive best practices",
    "Collaborate with product and design teams",
    "Ensure system reliability and performance",
  ],
  qualifications: [
    "5+ years of software development experience",
    "Strong proficiency in JavaScript/TypeScript and React",
    "Experience with cloud platforms (AWS/GCP/Azure)",
    "Knowledge of distributed systems and microservices",
    "Excellent problem-solving and communication skills",
  ],
  benefits: [
    "Health, dental, and vision insurance",
    "401(k) matching",
    "Unlimited PTO",
    "Remote work flexibility",
    "Professional development budget",
    "Wellness programs",
  ],
  keywords: [
    "software engineer",
    "full stack",
    "React",
    "Node.js",
    "AWS",
    "microservices",
  ],
  experienceLevel: "senior",
  techStack: [
    "React",
    "Node.js",
    "Python",
    "AWS",
    "Docker",
    "Kubernetes",
    "PostgreSQL",
    "MongoDB",
  ],
  industryKeywords: [
    "advertising technology",
    "martech",
    "digital transformation",
  ],
  postedDate: "2026-02-10",
  applicationDeadline: null,
  originalUrl: "https://careers.publicisgroupe.com/jobs/125448",
};

export const mockTailoredResumeResponse = {
  personalInfo: {
    fullName: "John Doe",
    email: "john.doe@email.com",
    phone: "(555) 123-4567",
    location: "San Francisco, CA",
    linkedInUrl: "https://linkedin.com/in/johndoe",
    githubUrl: "https://github.com/johndoe",
    portfolioUrl: "https://johndoe.dev",
  },
  summary: `Full-stack software engineer with 5+ years of experience building scalable web applications using React, Node.js, and cloud technologies. Passionate about developing innovative solutions that drive business value.

As a former electrical technician, I bring a unique perspective to software development - combining hands-on problem-solving skills with a systematic approach to building reliable systems. At Tech Startup Inc, I led the redesign of our main dashboard that improved user engagement by 40%.

I'm excited about the opportunity to bring my technical skills and passion for continuous learning to Publicis Groupe, where I can contribute to building cutting-edge advertising technology while working with a talented team.`,
  experiences: [
    {
      id: "exp-1",
      company: "Tech Startup Inc",
      title: "Full Stack Developer",
      location: "San Francisco, CA",
      startDate: new Date("2023-06-01"),
      endDate: null,
      current: true,
      achievements: [
        {
          description:
            "Led the redesign of the main dashboard, improving user engagement by 40%",
          metrics: "40% increase in user engagement",
          impact: "high",
        },
        {
          description:
            "Developed and deployed RESTful APIs serving 100k+ daily requests",
          metrics: "100k+ daily requests",
          impact: "high",
        },
      ],
      technologies: ["React", "Node.js", "PostgreSQL", "AWS", "Docker"],
      relevanceScore: 95,
    },
  ],
  projects: [
    {
      id: "proj-1",
      name: "E-commerce Platform",
      description: "Full-featured e-commerce platform",
      role: "Lead Developer",
      technologies: ["React", "Node.js", "PostgreSQL", "Stripe"],
      achievements: ["Built RESTful API handling 500+ orders per day"],
      relevanceScore: 88,
    },
  ],
  skills: {
    matched: [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "AWS",
      "Docker",
      "PostgreSQL",
      "REST APIs",
    ],
    relevant: ["GraphQL", "MongoDB", "Git"],
    other: ["CSS", "HTML"],
  },
  education: [
    {
      institution: "University of California",
      degree: "Bachelor of Science",
      field: "Electrical Engineering",
      startDate: new Date("2017-09-01"),
      endDate: new Date("2021-05-15"),
      gpa: "3.5",
    },
  ],
  certifications: [
    {
      name: "AWS Certified Solutions Architect",
      issuer: "AWS",
      issueDate: new Date("2024-01-15"),
    },
  ],
  jobId: "test-job-123",
  jobTitle: "Senior Software Engineer",
  company: "Publicis Groupe",
  matchScore: 85,
  atsOptimized: true,
};

export const mockCoverLetterResponse = {
  yourName: "John Doe",
  yourAddress: "San Francisco, CA",
  yourEmail: "john.doe@email.com",
  yourPhone: "(555) 123-4567",
  date: "February 16, 2026",
  hiringManager: "Hiring Manager",
  recipientName: "Hiring Manager",
  recipientTitle: "Software Engineering Manager",
  companyName: "Publicis Groupe",
  companyAddress: "New York, NY",
  greeting: "Dear Hiring Manager,",
  opening:
    "I am writing to express my strong interest in the Senior Software Engineer position at Publicis Groupe. With over 5 years of experience building scalable web applications and a passion for innovative technology, I am excited about the opportunity to contribute to your team.",
  body: [
    "Throughout my career, I have developed expertise in full-stack development using React, Node.js, and cloud technologies. At Tech Startup Inc, I led the redesign of our main dashboard that resulted in a 40% improvement in user engagement, demonstrating my ability to deliver impactful solutions.",
    "I am particularly drawn to Publicis Groupe because of your commitment to innovation in advertising technology. Your focus on leveraging AI and data-driven solutions aligns perfectly with my interest in building cutting-edge applications that make a real business impact.",
    "I would welcome the opportunity to discuss how my technical skills and passion for continuous learning can contribute to your engineering team's success.",
  ],
  closing:
    "Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to Publicis Groupe's continued success.",
  signature: "Sincerely,\nJohn Doe",
  jobId: "test-job-123",
  jobTitle: "Senior Software Engineer",
  tone: "professional",
};

export const mockLinkedInMessageResponse = {
  type: "connection_request",
  subject: "Software Engineer interested in Publicis Groupe opportunity",
  message:
    "Hi [Name], I came across the Senior Software Engineer role at Publicis Groupe and wanted to connect. With 5+ years building scalable web applications using React, Node.js, and AWS, I'm excited about the opportunity to contribute to your team. I'd love to learn more about the role and how I can help drive innovation at Publicis. Best, John",
  characterCount: 298,
  tips: [
    "Personalize the message with their name",
    "Mention something specific about their work",
    "Follow up after 3-5 business days",
  ],
};

export const mockHiringManagerResponse = {
  managers: [
    {
      id: "hm-1",
      name: "Sarah Johnson",
      title: "VP of Engineering",
      company: "Publicis Groupe",
      linkedInUrl: "https://linkedin.com/in/sarahjohnson",
      email: "sarah.johnson@publicisgroupe.com",
      confidence: 85,
      source: "ai_suggestion",
      verified: false,
    },
  ],
  topMatch: {
    id: "hm-1",
    name: "Sarah Johnson",
    title: "VP of Engineering",
    company: "Publicis Groupe",
    linkedInUrl: "https://linkedin.com/in/sarahjohnson",
    confidence: 85,
    source: "ai_suggestion",
    verified: false,
  },
  searchMethod: "AI suggestion",
};

export const mockEmailResponse = {
  id: "email-1",
  type: "initial_followup",
  to: "sarah.johnson@publicisgroupe.com",
  subject: "Following up on Senior Software Engineer application",
  body: `Dear Sarah,

I hope this email finds you well. I wanted to follow up on my application for the Senior Software Engineer position at Publicis Groupe, which I submitted on February 10th.

I remain very excited about the opportunity to join your team and contribute to the innovative work happening at Publicis Groupe. With my experience in building scalable applications using React, Node.js, and cloud technologies, I believe I would be a strong fit for this role.

I would welcome the opportunity to discuss how my skills and experience align with your team's needs. Please let me know if you need any additional information.

Thank you for your time and consideration.

Best regards,
John Doe`,
  tone: "professional",
};

export function createLLMServiceMock() {
  return {
    complete: vi.fn().mockResolvedValue({
      success: true,
      data: JSON.stringify({ result: "mocked response" }),
    }),
    completeJSON: vi.fn().mockResolvedValue({
      success: true,
      data: mockJobAnalysisResponse,
    }),
    completeStructured: vi.fn().mockResolvedValue({
      success: true,
      data: mockJobAnalysisResponse,
    }),
  };
}

export function createWebScraperMock() {
  return {
    scrapeJobPosting: vi.fn().mockResolvedValue({
      title: "Senior Software Engineer",
      company: "Publicis Groupe",
      location: "New York, NY (Hybrid)",
      description: `
        Senior Software Engineer
        
        About the Role:
        We are looking for a Senior Software Engineer to join our team at Publicis Groupe.
        
        Requirements:
        - 5+ years of software development experience
        - Strong proficiency in JavaScript/TypeScript and React
        - Experience with cloud platforms (AWS/GCP/Azure)
        - Knowledge of distributed systems and microservices
        
        Benefits:
        - Health, dental, and vision insurance
        - 401(k) matching
        - Unlimited PTO
        - Remote work flexibility
      `,
      salary: "$140,000 - $180,000",
      jobType: "Full-time",
      remote: true,
    }),
  };
}
