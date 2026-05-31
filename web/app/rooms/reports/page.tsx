import { RoomContractView } from "../RoomContractView";

export default async function ReportsRoom({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RoomContractView room="reports_plans" title="Reports / Plans" searchParams={searchParams} />;
}

