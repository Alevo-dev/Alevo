import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { footerNav, siteConfig } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              {siteConfig.tagline} Warm, on-brand, and always on — across every
              channel.
            </p>
          </div>

          {footerNav.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => {
                  const external = /^https?:\/\//.test(item.href);
                  return (
                    <li key={item.label}>
                      {external ? (
                        <a
                          href={item.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a href={siteConfig.social.twitter} className="hover:text-foreground">
              X
            </a>
            <a href={siteConfig.social.linkedin} className="hover:text-foreground">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
