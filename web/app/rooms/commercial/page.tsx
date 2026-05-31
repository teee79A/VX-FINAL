import { RoomContractView } from "../RoomContractView";

export default async function CommercialRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="commercial" title="Commercial" searchParams={searchParams} />;
}

