import { LuCompass, LuHouse } from "react-icons/lu";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/primitives";

export default function NotFoundPage() {
  return (
    <div className="container page page-enter">
      <EmptyState
        icon={<LuCompass />}
        title="This page wandered off the menu"
        action={
          <div className="row" style={{ justifyContent: "center" }}>
            <ButtonLink to="/" variant="primary" icon={<LuHouse />}>
              Back home
            </ButtonLink>
            <ButtonLink to="/recipes" variant="secondary">
              Discover recipes
            </ButtonLink>
          </div>
        }
      >
        The link may be outdated, or the page may have moved.
      </EmptyState>
    </div>
  );
}
