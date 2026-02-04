// src/cli/utils/prompts.ts
import inquirer from "inquirer";
import chalk from "chalk";

export interface ExperiencePrompt {
  company: string;
  title: string;
  location: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
  achievements: Array<{
    description: string;
    metrics?: string;
    impactLevel: "high" | "medium" | "low";
  }>;
  technologies: string[];
}

export interface ProjectPrompt {
  name: string;
  description: string;
  role: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  technologies: string[];
  achievements: Array<{
    description: string;
    metrics?: string;
    impactLevel: "high" | "medium" | "low";
  }>;
  url?: string;
  githubUrl?: string;
}

export interface SkillPrompt {
  name: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced" | "expert";
  yearsOfExperience?: number;
}

export interface EducationPrompt {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  gpa?: string;
  achievements?: string[];
}

const COMMON_TECHNOLOGIES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C#",
  "Go",
  "Rust",
  "React",
  "Vue.js",
  "Angular",
  "Svelte",
  "Next.js",
  "Express.js",
  "Node.js",
  "Django",
  "Flask",
  "Spring Boot",
  "ASP.NET",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "Docker",
  "Kubernetes",
  "AWS",
  "Azure",
  "GCP",
  "Terraform",
  "Git",
  "GitHub",
  "GitLab",
  "CI/CD",
  "Jenkins",
  "GitHub Actions",
  "GraphQL",
  "REST API",
  "gRPC",
  "WebSocket",
  "Microservices",
];

const SKILL_CATEGORIES = [
  "Programming Languages",
  "Frontend",
  "Backend",
  "Database",
  "Cloud & DevOps",
  "Mobile",
  "AI/ML",
  "Testing",
  "Tools & Others",
];

const IMPACT_LEVELS = [
  { name: "High", value: "high", description: "Major business impact" },
  { name: "Medium", value: "medium", description: "Significant contribution" },
  { name: "Low", value: "low", description: "Minor improvement" },
];

const SKILL_LEVELS = [
  {
    name: "Expert",
    value: "expert",
    description: "5+ years, can teach others",
  },
  {
    name: "Advanced",
    value: "advanced",
    description: "3-5 years, independent",
  },
  {
    name: "Intermediate",
    value: "intermediate",
    description: "1-3 years, some guidance",
  },
  { name: "Beginner", value: "beginner", description: "0-1 year, learning" },
];

export async function promptExperience(): Promise<ExperiencePrompt> {
  console.log(chalk.bold.cyan("\nAdd Work Experience"));
  console.log(chalk.gray("─".repeat(50)));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "company",
      message: "Company name:",
      validate: (input: string) =>
        input.trim().length > 0 || "Company name is required",
    },
    {
      type: "input",
      name: "title",
      message: "Job title:",
      validate: (input: string) =>
        input.trim().length > 0 || "Job title is required",
    },
    {
      type: "input",
      name: "location",
      message: "Location:",
      validate: (input: string) =>
        input.trim().length > 0 || "Location is required",
    },
    {
      type: "input",
      name: "startDate",
      message: "Start date (YYYY-MM-DD):",
      validate: (input: string) => {
        const date = new Date(input);
        return (
          (!isNaN(date.getTime()) && input.match(/^\d{4}-\d{2}-\d{2}$/)) ||
          "Please enter a valid date in YYYY-MM-DD format"
        );
      },
    },
    {
      type: "confirm",
      name: "current",
      message: "Is this your current position?",
      default: false,
    },
  ]);

  if (!answers.current) {
    const endDateAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "endDate",
        message: "End date (YYYY-MM-DD, leave empty if current):",
        validate: (input: string) => {
          if (!input.trim()) return true;
          const date = new Date(input);
          const start = new Date(answers.startDate);
          return (
            (!isNaN(date.getTime()) &&
              input.match(/^\d{4}-\d{2}-\d{2}$/) &&
              date > start) ||
            "Please enter a valid date after start date in YYYY-MM-DD format"
          );
        },
      },
    ]);
    answers.endDate = endDateAnswer.endDate
      ? new Date(endDateAnswer.endDate)
      : undefined;
  }

  const descriptionAnswer = await inquirer.prompt([
    {
      type: "input",
      name: "description",
      message: "Job description (optional):",
    },
  ]);

  // Achievements
  console.log(chalk.bold.cyan("\nAdd Achievements"));
  console.log(chalk.gray("─".repeat(30)));

  const achievements = [];
  let addMore = true;

  while (addMore) {
    const achievementAnswers: {
      description: string;
      metrics?: string;
      impactLevel: "high" | "medium" | "low";
    } = await inquirer.prompt([
      {
        type: "input",
        name: "description",
        message: `Achievement #${achievements.length + 1}:`,
        validate: (input: string) =>
          input.trim().length > 0 || "Achievement description is required",
      },
      {
        type: "input",
        name: "metrics",
        message: "Metrics (optional):",
      },
      {
        type: "list",
        name: "impactLevel",
        message: "Impact level:",
        choices: IMPACT_LEVELS.map((level) => ({
          name: `${level.name} - ${level.description}`,
          value: level.value,
        })),
        default: "medium",
      },
    ]);

    achievements.push(achievementAnswers);

    const continueAnswer = await inquirer.prompt([
      {
        type: "confirm",
        name: "continue",
        message: "Add another achievement?",
        default: false,
      },
    ]);
    addMore = continueAnswer.continue;
  }

  // Technologies
  console.log(chalk.bold.cyan("\nTechnologies Used"));
  console.log(chalk.gray("─".repeat(30)));

  const techAnswers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "technologies",
      message: "Select technologies:",
      choices: COMMON_TECHNOLOGIES,
      pageSize: 15,
    },
  ]);

  const customTechAnswer = await inquirer.prompt([
    {
      type: "confirm",
      name: "addCustom",
      message: "Add custom technologies?",
      default: false,
    },
  ]);

  if (customTechAnswer.addCustom) {
    const customAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "custom",
        message: "Enter technologies (comma-separated):",
      },
    ]);

    const customTechs = customAnswer.custom
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t);
    techAnswers.technologies.push(...customTechs);
  }

  return {
    company: answers.company,
    title: answers.title,
    location: answers.location,
    startDate: new Date(answers.startDate),
    endDate: answers.endDate,
    current: answers.current,
    description: descriptionAnswer.description || undefined,
    achievements,
    technologies: techAnswers.technologies,
  };
}

export async function promptProject(): Promise<ProjectPrompt> {
  console.log(chalk.bold.cyan("\nAdd Project"));
  console.log(chalk.gray("─".repeat(30)));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Project name:",
      validate: (input: string) =>
        input.trim().length > 0 || "Project name is required",
    },
    {
      type: "input",
      name: "description",
      message: "Project description:",
      validate: (input: string) =>
        input.trim().length > 0 || "Description is required",
    },
    {
      type: "input",
      name: "role",
      message: "Your role:",
      validate: (input: string) =>
        input.trim().length > 0 || "Role is required",
    },
    {
      type: "input",
      name: "startDate",
      message: "Start date (YYYY-MM-DD):",
      validate: (input: string) => {
        const date = new Date(input);
        return (
          (!isNaN(date.getTime()) && input.match(/^\d{4}-\d{2}-\d{2}$/)) ||
          "Please enter a valid date in YYYY-MM-DD format"
        );
      },
    },
    {
      type: "confirm",
      name: "current",
      message: "Is this project ongoing?",
      default: false,
    },
  ]);

  if (!answers.current) {
    const endDateAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "endDate",
        message: "End date (YYYY-MM-DD, leave empty if ongoing):",
        validate: (input: string) => {
          if (!input.trim()) return true;
          const date = new Date(input);
          const start = new Date(answers.startDate);
          return (
            (!isNaN(date.getTime()) &&
              input.match(/^\d{4}-\d{2}-\d{2}$/) &&
              date > start) ||
            "Please enter a valid date after start date in YYYY-MM-DD format"
          );
        },
      },
    ]);
    answers.endDate = endDateAnswer.endDate
      ? new Date(endDateAnswer.endDate)
      : undefined;
  }

  const urlsAnswer = await inquirer.prompt([
    {
      type: "input",
      name: "url",
      message: "Project URL (optional):",
    },
    {
      type: "input",
      name: "githubUrl",
      message: "GitHub URL (optional):",
    },
  ]);

  // Achievements
  console.log(chalk.bold.cyan("\nAdd Achievements"));
  console.log(chalk.gray("─".repeat(30)));

  const achievements = [];
  let addMore = true;

  while (addMore) {
    const achievementAnswers: {
      description: string;
      metrics?: string;
      impactLevel: "high" | "medium" | "low";
    } = await inquirer.prompt([
      {
        type: "input",
        name: "description",
        message: `Achievement #${achievements.length + 1}:`,
        validate: (input: string) =>
          input.trim().length > 0 || "Achievement description is required",
      },
      {
        type: "input",
        name: "metrics",
        message: "Metrics (optional):",
      },
      {
        type: "list",
        name: "impactLevel",
        message: "Impact level:",
        choices: IMPACT_LEVELS.map((level) => ({
          name: `${level.name} - ${level.description}`,
          value: level.value,
        })),
        default: "medium",
      },
    ]);

    achievements.push(achievementAnswers);

    const continueAnswer = await inquirer.prompt([
      {
        type: "confirm",
        name: "continue",
        message: "Add another achievement?",
        default: false,
      },
    ]);
    addMore = continueAnswer.continue;
  }

  // Technologies
  console.log(chalk.bold.cyan("\nTechnologies Used"));
  console.log(chalk.gray("─".repeat(30)));

  const techAnswers = await inquirer.prompt([
    {
      type: "checkbox",
      name: "technologies",
      message: "Select technologies:",
      choices: COMMON_TECHNOLOGIES,
      pageSize: 15,
    },
  ]);

  const customTechAnswer = await inquirer.prompt([
    {
      type: "confirm",
      name: "addCustom",
      message: "Add custom technologies?",
      default: false,
    },
  ]);

  if (customTechAnswer.addCustom) {
    const customAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "custom",
        message: "Enter technologies (comma-separated):",
      },
    ]);

    const customTechs = customAnswer.custom
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t);
    techAnswers.technologies.push(...customTechs);
  }

  return {
    name: answers.name,
    description: answers.description,
    role: answers.role,
    startDate: new Date(answers.startDate),
    endDate: answers.endDate,
    current: answers.current,
    technologies: techAnswers.technologies,
    achievements,
    url: urlsAnswer.url || undefined,
    githubUrl: urlsAnswer.githubUrl || undefined,
  };
}

export async function promptSkill(): Promise<SkillPrompt> {
  console.log(chalk.bold.cyan("\nAdd Skill"));
  console.log(chalk.gray("─".repeat(20)));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Skill name:",
      validate: (input: string) =>
        input.trim().length > 0 || "Skill name is required",
    },
    {
      type: "list",
      name: "category",
      message: "Category:",
      choices: SKILL_CATEGORIES,
      default: "Programming Languages",
    },
    {
      type: "list",
      name: "level",
      message: "Proficiency level:",
      choices: SKILL_LEVELS.map((level) => ({
        name: `${level.name} - ${level.description}`,
        value: level.value,
      })),
      default: "intermediate",
    },
    {
      type: "input",
      name: "yearsOfExperience",
      message: "Years of experience (optional):",
      validate: (input: string) => {
        if (!input.trim()) return true;
        const years = parseFloat(input);
        return (!isNaN(years) && years >= 0) || "Please enter a valid number";
      },
      filter: (input: string) => (input.trim() ? parseFloat(input) : undefined),
    },
  ]);

  return {
    name: answers.name,
    category: answers.category,
    level: answers.level,
    yearsOfExperience: answers.yearsOfExperience,
  };
}

export async function promptEducation(): Promise<EducationPrompt> {
  console.log(chalk.bold.cyan("\nAdd Education"));
  console.log(chalk.gray("─".repeat(25)));

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "institution",
      message: "Institution name:",
      validate: (input: string) =>
        input.trim().length > 0 || "Institution name is required",
    },
    {
      type: "input",
      name: "degree",
      message: "Degree:",
      validate: (input: string) =>
        input.trim().length > 0 || "Degree is required",
    },
    {
      type: "input",
      name: "field",
      message: "Field of study:",
      validate: (input: string) =>
        input.trim().length > 0 || "Field of study is required",
    },
    {
      type: "input",
      name: "startDate",
      message: "Start date (YYYY-MM-DD):",
      validate: (input: string) => {
        const date = new Date(input);
        return (
          (!isNaN(date.getTime()) && input.match(/^\d{4}-\d{2}-\d{2}$/)) ||
          "Please enter a valid date in YYYY-MM-DD format"
        );
      },
    },
    {
      type: "confirm",
      name: "current",
      message: "Are you currently studying?",
      default: false,
    },
  ]);

  if (!answers.current) {
    const endDateAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "endDate",
        message: "End date (YYYY-MM-DD, leave empty if current):",
        validate: (input: string) => {
          if (!input.trim()) return true;
          const date = new Date(input);
          const start = new Date(answers.startDate);
          return (
            (!isNaN(date.getTime()) &&
              input.match(/^\d{4}-\d{2}-\d{2}$/) &&
              date > start) ||
            "Please enter a valid date after start date in YYYY-MM-DD format"
          );
        },
      },
    ]);
    answers.endDate = endDateAnswer.endDate
      ? new Date(endDateAnswer.endDate)
      : undefined;
  }

  const additionalAnswer = await inquirer.prompt([
    {
      type: "input",
      name: "gpa",
      message: "GPA (optional):",
      validate: (input: string) => {
        if (!input.trim()) return true;
        const gpa = parseFloat(input);
        return (
          (!isNaN(gpa) && gpa >= 0 && gpa <= 4.0) ||
          "Please enter a valid GPA (0.0-4.0)"
        );
      },
    },
  ]);

  return {
    institution: answers.institution,
    degree: answers.degree,
    field: answers.field,
    startDate: new Date(answers.startDate),
    endDate: answers.endDate,
    current: answers.current,
    gpa: additionalAnswer.gpa || undefined,
  };
}
