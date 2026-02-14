"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faWallet,
  faLayerGroup,
  faMoneyBillTransfer,
  faFileImport,
  faGear,
  faBars,
  faChevronLeft
} from "@fortawesome/free-solid-svg-icons";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: faChartLine },
  { href: "/accounts", label: "Accounts", icon: faWallet },
  { href: "/categories", label: "Categories", icon: faLayerGroup },
  { href: "/transactions", label: "Transactions", icon: faMoneyBillTransfer },
  { href: "/imports", label: "AI Imports", icon: faFileImport },
  { href: "/settings", label: "Settings", icon: faGear }
];

export function AppNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem("ff.sidebar.open");
    if (saved === "0") {
      setIsOpen(false);
      return;
    }
    if (saved === "1") {
      setIsOpen(true);
      return;
    }
    setIsOpen(window.innerWidth >= 1024);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ff.sidebar.open", isOpen ? "1" : "0");
  }, [isOpen]);

  return (
    <>
      {!isOpen && (
        <button type="button" className="sidebar-fab" aria-label="Show menu" onClick={() => setIsOpen(true)}>
          <FontAwesomeIcon icon={faBars} />
        </button>
      )}
      <aside className={`app-sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="sidebar-head">
          <div className="brand">FinanceFlow</div>
          <button type="button" className="sidebar-toggle" aria-label="Hide menu" onClick={() => setIsOpen(false)}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
        </div>
        <div className="sidebar-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`sidebar-link ${pathname === link.href ? "active" : ""}`}>
              <span className="sidebar-link-icon">
                <FontAwesomeIcon icon={link.icon} />
              </span>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}
