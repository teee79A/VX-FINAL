import { RoomContractView } from "../RoomContractView";

export default async function SystemRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="system" title="System" searchParams={searchParams} />;
}

