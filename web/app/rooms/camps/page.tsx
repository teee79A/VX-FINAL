import { RoomContractView } from "../RoomContractView";

export default async function CampsRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="camp" title="Camp" searchParams={searchParams} />;
}

