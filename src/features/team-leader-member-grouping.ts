export type TeamMemberRole = 'leader' | 'member';

export interface TeamMember {
  id: string;
  displayName: string;
  role: TeamMemberRole;
  leaderId?: string;
  teamId?: string;
}

export interface LeaderMemberGroup {
  leader: TeamMember;
  members: TeamMember[];
}

export interface GroupedTeamMembers {
  grouped: LeaderMemberGroup[];
  unassignedMembers: TeamMember[];
}

const normalizeOptionalValue = (value?: string): string | undefined => {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
};

const normalizeTeamMember = (member: TeamMember): TeamMember => ({
  ...member,
  id: member.id.trim(),
  displayName: member.displayName.trim(),
  leaderId: normalizeOptionalValue(member.leaderId),
  teamId: normalizeOptionalValue(member.teamId),
});

const byDisplayName = (a: TeamMember, b: TeamMember): number => a.displayName.localeCompare(b.displayName);

export const groupMembersByLeader = (members: TeamMember[]): GroupedTeamMembers => {
  const normalizedMembers = members.map(normalizeTeamMember);
  const leaders = normalizedMembers
    .filter((member) => member.role === 'leader')
    .sort(byDisplayName);

  const leaderMap = new Map(leaders.map((leader) => [leader.id, leader]));
  const grouped = leaders.map<LeaderMemberGroup>((leader) => ({ leader, members: [] }));
  const groupedIndexByLeaderId = new Map(grouped.map((group, index) => [group.leader.id, index]));
  const unassignedMembers: TeamMember[] = [];

  normalizedMembers
    .filter((member) => member.role === 'member')
    .sort(byDisplayName)
    .forEach((member) => {
      if (!member.leaderId || !leaderMap.has(member.leaderId)) {
        unassignedMembers.push(member);

        return;
      }

      const groupIndex = groupedIndexByLeaderId.get(member.leaderId);

      if (groupIndex === undefined) {
        unassignedMembers.push(member);

        return;
      }

      grouped[groupIndex].members.push(member);
    });

  return {
    grouped,
    unassignedMembers,
  };
};

export const buildLeaderLookup = (members: TeamMember[]): Map<string, TeamMember> => {
  const lookup = new Map<string, TeamMember>();

  members
    .map(normalizeTeamMember)
    .filter((member) => member.role === 'leader')
    .forEach((leader) => {
      lookup.set(leader.id, leader);
    });

  return lookup;
};
