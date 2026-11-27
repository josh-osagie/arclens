import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { TierHeaderNodeData } from "./layoutTieredOverview";

function TierHeaderNodeComponent({ data }: NodeProps) {
  const header = data as unknown as TierHeaderNodeData;
  return (
    <div className="atlas-tier-header" aria-hidden="true">
      <span className="atlas-tier-header__title">{header.label}</span>
      <span className="atlas-tier-header__line" />
      <span className="atlas-tier-header__count">
        {header.count} {header.count === 1 ? "domain" : "domains"}
      </span>
    </div>
  );
}

export const AtlasTierHeaderNode = memo(TierHeaderNodeComponent);
