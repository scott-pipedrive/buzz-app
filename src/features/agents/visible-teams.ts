import type { Agents } from "./service";
import type { Team } from "./store";
import { communityDestination } from "../communities/destination";
import { splitPartition } from "../relay/partition";

/** The same team inventory in Your teams and the composer's community. */
export function visibleTeams(
  agents: Pick<Agents, "snapshot" | "memberships" | "teamHere">,
  community?: string,
) {
  const snapshot = agents.snapshot();
  const members = new Set(
    snapshot.agents
      .filter((agent) => {
        if (!community) return true;
        try {
          return communityDestination(agent.relay).url === community;
        } catch {
          return false;
        }
      })
      .map((agent) => agent.pubkey),
  );
  return snapshot.teams.filter(
    (team) =>
      team.members.some(
        (pubkey) =>
          members.has(pubkey) ||
          (!!community &&
            agents
              .memberships(pubkey)
              .some(({ origin }) => origin === community)),
      ) ||
      (team.revision
        ? !team.members.length || agents.teamHere({ id: team.id }, community)
        : !team.members.some((pubkey) => agents.memberships(pubkey).length)),
  );
}

export function mentionableTeams(agents: Agents | undefined, scope: string) {
  return agents
    ? visibleTeams(agents, splitPartition(scope)?.communityOrigin)
    : [];
}

/** Bind a draft's team selection to the exact roster the user chose. */
export function teamMentionKey(team: Team) {
  return JSON.stringify([team.id, team.lead, [...team.members].sort()]);
}

export function teamMentionMembers(
  agents: Agents | undefined,
  scope: string,
  recipients: readonly Readonly<{ pubkey: string; team?: string }>[],
) {
  const selected = recipients.filter(({ team }) => team !== undefined);
  if (!selected.length) return [];
  const teams = mentionableTeams(agents, scope);
  return [
    ...new Set(
      selected.flatMap((recipient) => {
        const team = teams.find(
          (team) =>
            team.lead === recipient.pubkey &&
            teamMentionKey(team) === recipient.team,
        );
        if (!team?.members.includes(recipient.pubkey))
          throw new Error(
            "The team changed. Remove its mention and select it again.",
          );
        return team.members.filter((key) => key !== recipient.pubkey);
      }),
    ),
  ];
}
