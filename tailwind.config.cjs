/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brandSidebar: "#0E5C4A",
        brandAccent: "#2BB673",
        pageBg: "#F5F8FA"
      },
      boxShadow: {
        glass: "0 10px 30px rgba(15, 23, 42, 0.08)"
      },
      borderRadius: {
        "2xl": "1rem"
      },
      backgroundImage: {
        "medical-gradient": "linear-gradient(to right, #0E5C4A, #2BB673)"
      }
    }
  },
  plugins: []
};
