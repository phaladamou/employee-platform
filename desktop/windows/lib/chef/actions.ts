// lib/chef/actions.ts
//
// Les 3 cartes d'action du chat vide (donnees pures, rendues par
// components/workspace/chef-action-cards.tsx). Titres et textes via
// next-intl (namespace "chat", messages/{en,fr,zh}.json) : deux
// cartes naviguent (href interne), la troisieme envoie un message
// d'ouverture que le moteur traite comme un besoin direct.
// Verrouille par actions.test.ts (cles presentes partout, routes
// existantes, ouvreurs compris par le moteur).
export interface ChefActionCard {
  id: "recruit" | "mission" | "team";
  titleKey: string;
  descriptionKey: string;
  href: string | null;
  openerKey: string | null;
}

export const CHEF_ACTION_CARDS: ChefActionCard[] = [
  {
    id: "recruit",
    titleKey: "actionRecruitTitle",
    descriptionKey: "actionRecruitDescription",
    href: "/employees/recruit",
    openerKey: null,
  },
  {
    id: "mission",
    titleKey: "actionMissionTitle",
    descriptionKey: "actionMissionDescription",
    href: null,
    openerKey: "actionMissionOpener",
  },
  {
    id: "team",
    titleKey: "actionTeamTitle",
    descriptionKey: "actionTeamDescription",
    href: "/employees",
    openerKey: null,
  },
];
