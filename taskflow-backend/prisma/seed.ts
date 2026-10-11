import { PrismaClient, TaskPriority, TaskStatus, OrgMemberRole } from "@prisma/client";
import bcrypt from "bcrypt";
const prisma = new PrismaClient();
const DEMO_PASSWORD = "TaskFlowDemo123!";
const users = [
  {
    id: "d62bbbcc-1215-42ac-9866-c366b716c35d",
    email: "ava.shah@northstar.example",
    name: "Ava Shah",
    
  },
  {
    id: "917ffeaf-f862-4411-82c3-b0f8629d0a0f",
    email: "liam.chen@northstar.example",
    name: "Liam Chen",
    
  },
  {
    id: "fc7bf23b-2977-4ed4-a83b-8dfa30038857",
    email: "maya.rao@northstar.example",
    name: "Maya Rao",
    
  },
  {
    id: "69c25c40-f288-4dc4-8335-747a6e281d98",
    email: "noah.kim@blueorbit.example",
    name: "Noah Kim",
    
  },
  {
    id: "93b3a605-c229-46be-9311-5c9e698e2726",
    email: "sara.ali@blueorbit.example",
    name: "Sara Ali",
    
  }
] as const;

const organizations = [
  {
    id: "a0ab963b-d0ad-4f44-a160-11b5ca2dfa2f",
    name: "Northstar Labs"
  },
  {
    id: "5193eee1-95a3-499a-9be2-c171d4eb28c8",
    name: "Blue Orbit Studio"
  }
] as const;

const orgMembers = [
  {
    organizationId: organizations[0].id,
    userId: users[0].id,
    role: OrgMemberRole.ORG_ADMIN
  },
  {
    organizationId: organizations[0].id,
    userId: users[1].id,
    role: OrgMemberRole.MEMBER
  },
  {
    organizationId: organizations[0].id,
    userId: users[2].id,
    role: OrgMemberRole.MEMBER
  },
  {
    organizationId: organizations[1].id,
    userId: users[3].id,
    role: OrgMemberRole.ORG_ADMIN
  },
  {
    organizationId: organizations[1].id,
    userId: users[4].id,
    role: OrgMemberRole.MEMBER
  }
] as const;

const projects = [
  {
    id: "c1111111-1111-4111-8111-111111111111",
    organizationId: organizations[0].id,
    name: "Customer Portal Refresh",
    description: "Refresh the customer-facing portal before Q4 onboarding."
  },
  {
    id: "c2222222-2222-4222-8222-222222222222",
    organizationId: organizations[0].id,
    name: "Internal Ops Dashboard",
    description: "Create a shared operations dashboard for support and finance."
  },
  {
    id: "d1111111-1111-4111-8111-111111111111",
    organizationId: organizations[1].id,
    name: "Mobile Launch Prep",
    description: "Prepare launch assets and release readiness for the mobile app."
  },
  {
    id: "d2222222-2222-4222-8222-222222222222",
    organizationId: organizations[1].id,
    name: "Client Delivery Revamp",
    description: "Improve delivery workflows for premium client engagements."
  }
] as const;

const tasks = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    projectId: projects[0].id,
    title: "Audit portal navigation",
    description: "Review current navigation pain points from recent user interviews.",
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date("2026-09-05T10:00:00.000Z")
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    projectId: projects[0].id,
    title: "Ship updated account settings layout",
    description: "Implement the new account settings information hierarchy.",
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    dueDate: new Date("2026-09-08T10:00:00.000Z")
  },
  {
    id: "70000000-0000-4000-8000-000000000003",
    projectId: projects[0].id,
    title: "Review support center copy",
    description: "Finalize revised help center entry points before launch review.",
    status: TaskStatus.REVIEW,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date("2026-09-10T10:00:00.000Z")
  },
  {
    id: "70000000-0000-4000-8000-000000000004",
    projectId: projects[1].id,
    title: "Define dashboard KPI list",
    description: "Confirm which operational KPIs are required in the first release.",
    status: TaskStatus.DONE,
    priority: TaskPriority.LOW,
    dueDate: new Date("2026-08-30T10:00:00.000Z")
  },
  {
    id: "70000000-0000-4000-8000-000000000005",
    projectId: projects[1].id,
    title: "Add revenue variance widget",
    description: "Surface weekly revenue variance for finance stakeholders.",
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.HIGH,
    dueDate: new Date("2026-09-12T10:00:00.000Z")
  },
  {
    id: "70000000-0000-4000-8000-000000000006",
    projectId: projects[1].id,
    title: "Backfill historical support metrics",
    description: "Load the last 12 months of support resolution metrics.",
    status: TaskStatus.TODO,
    priority: TaskPriority.URGENT,
    dueDate: new Date("2026-09-15T10:00:00.000Z")
  },
  {
    id: "80000000-0000-4000-8000-000000000001",
    projectId: projects[2].id,
    title: "Finalize launch checklist",
    description: "Lock the launch checklist shared with product and QA.",
    status: TaskStatus.REVIEW,
    priority: TaskPriority.HIGH,
    dueDate: new Date("2026-09-03T10:00:00.000Z")
  },
  {
    id: "80000000-0000-4000-8000-000000000002",
    projectId: projects[2].id,
    title: "Prepare app store screenshots",
    description: "Export approved mobile screenshots for both stores.",
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date("2026-09-06T10:00:00.000Z")
  },
  {
    id: "80000000-0000-4000-8000-000000000003",
    projectId: projects[2].id,
    title: "Coordinate beta feedback triage",
    description: "Consolidate final beta feedback into launch-critical issues.",
    status: TaskStatus.IN_PROGRESS,
    priority: TaskPriority.URGENT,
    dueDate: new Date("2026-09-04T10:00:00.000Z")
  },
  {
    id: "80000000-0000-4000-8000-000000000004",
    projectId: projects[3].id,
    title: "Draft revised client handoff template",
    description: "Reduce ambiguity during project delivery handoff meetings.",
    status: TaskStatus.DONE,
    priority: TaskPriority.MEDIUM,
    dueDate: new Date("2026-08-28T10:00:00.000Z")
  },
  {
    id: "80000000-0000-4000-8000-000000000005",
    projectId: projects[3].id,
    title: "Map delivery bottlenecks",
    description: "Identify bottlenecks in the current premium delivery workflow.",
    status: TaskStatus.REVIEW,
    priority: TaskPriority.HIGH,
    dueDate: new Date("2026-09-09T10:00:00.000Z")
  },
  {
    id: "80000000-0000-4000-8000-000000000006",
    projectId: projects[3].id,
    title: "Pilot weekly delivery standup",
    description: "Run a two-week standup experiment with the delivery team.",
    status: TaskStatus.TODO,
    priority: TaskPriority.LOW,
    dueDate: new Date("2026-09-13T10:00:00.000Z")
  }
] as const;

const taskAssignments = [
  { taskId: tasks[0].id, userId: users[0].id },
  { taskId: tasks[1].id, userId: users[1].id },
  { taskId: tasks[1].id, userId: users[2].id },
  { taskId: tasks[2].id, userId: users[0].id },
  { taskId: tasks[4].id, userId: users[2].id },
  { taskId: tasks[5].id, userId: users[1].id },
  { taskId: tasks[6].id, userId: users[3].id },
  { taskId: tasks[7].id, userId: users[4].id },
  { taskId: tasks[8].id, userId: users[3].id },
  { taskId: tasks[9].id, userId: users[4].id },
  { taskId: tasks[10].id, userId: users[3].id },
  { taskId: tasks[11].id, userId: users[4].id }
] as const;

const comments = [
  {
    id: "90000000-0000-4000-8000-000000000001",
    taskId: tasks[1].id,
    authorId: users[0].id,
    content: "Please keep the settings navigation aligned with the updated IA draft."
  },
  {
    id: "90000000-0000-4000-8000-000000000002",
    taskId: tasks[2].id,
    authorId: users[2].id,
    content: "Copy updates are done. Waiting on support lead approval."
  },
  {
    id: "90000000-0000-4000-8000-000000000003",
    taskId: tasks[5].id,
    authorId: users[1].id,
    content: "Historical export is larger than expected, so batching may be safer."
  },
  {
    id: "90000000-0000-4000-8000-000000000004",
    taskId: tasks[8].id,
    authorId: users[4].id,
    content: "Beta feedback from the onboarding cohort should be prioritized first."
  },
  {
    id: "90000000-0000-4000-8000-000000000005",
    taskId: tasks[10].id,
    authorId: users[3].id,
    content: "The revised delivery swimlane is ready for leadership review."
  },
  {
    id: "90000000-0000-4000-8000-000000000006",
    taskId: tasks[11].id,
    authorId: users[4].id,
    content: "I can facilitate the pilot standup notes for the first week."
  }
] as const;

async function main(): Promise<void> {
  const demoPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.$transaction([
    prisma.comment.deleteMany(),
    prisma.taskAssignment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.orgMember.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.user.deleteMany()
  ]);

  await prisma.user.createMany({
  data: users.map((user) => ({...user,passwordHash: demoPasswordHash}))});
  await prisma.organization.createMany({ data: [...organizations] });
  await prisma.orgMember.createMany({ data: [...orgMembers] });
  await prisma.project.createMany({ data: [...projects] });
  await prisma.task.createMany({ data: [...tasks] });
  await prisma.taskAssignment.createMany({ data: [...taskAssignments] });
  await prisma.comment.createMany({ data: [...comments] });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Prisma seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
