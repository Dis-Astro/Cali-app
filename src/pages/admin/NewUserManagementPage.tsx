import { useEffect } from "react";
import UserManagement from "./UserManagement";

const NewUserManagementPage = () => {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((item) =>
        item.textContent?.toLowerCase().includes("nuovo utente"),
      );

      if (button) {
        button.click();
        window.clearInterval(timer);
      } else if (attempts >= 40) {
        window.clearInterval(timer);
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, []);

  return <UserManagement />;
};

export default NewUserManagementPage;
