export const metadata = {
  title: "Smart Reorder Inventory",
  description: "DR's Secret & Avance Supplements Inventory",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
