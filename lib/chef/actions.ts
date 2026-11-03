// lib/chef/actions.ts
//
// Les 3 cartes d'action sous la presentation du Chef (donnees pures,
// rendues par components/workspace/chef-action-cards.tsx). Deux
// cartes naviguent (href interne), la troisieme envoie un message
// d'ouverture que le moteur traite comme un besoin direct.
// Verrouille par actions.test.ts (copie exact + routes existantes).
export interface ChefActionCard {
  id: "recruit" | "mission" | "team";
  title: string;
  description: string;
  href: string | null;
  missionOpener: string | null;
}

export const CHEF_ACTION_CARDS: ChefActionCard[] = [
  {
    id: "recruit",
    title: "Recruit Talent",
    description: "Discover specialized AI employees and build your team.",
    href: "/employees/recruit",
    missionOpener: null,
  },
  {
    id: "mission",
    title: "Start a Mission",
    description: "Give a task to one of your employees and get a report.",
    href: null,
    missionOpener: "I want to start a mission.",
  },
  {
    id: "team",
    title: "View Team",
    description: "Check the status of your employees and their history.",
    href: "/employees",
    missionOpener: null,
  },
];
