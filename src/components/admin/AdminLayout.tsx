import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import AdminSidebar from "./AdminSidebar";
import AdminBottomNav from "./AdminBottomNav";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
  showBackLink?: boolean;
  hideSidebar?: boolean;
}

const AdminLayout = ({ children, title, icon, showBackLink = false, hideSidebar = false }: AdminLayoutProps) =>