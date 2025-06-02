import React from "react";

export default function Toast({ show, message }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "rgba(55,55,55,0.95)",
        color: "#fff",
        padding: "16px 28px",
        borderRadius: 8,
        fontSize: 17,
        letterSpacing: 1,
        boxShadow: "0 2px 8px #2224",
        zIndex: 9999,
        transition: "all .3s"
      }}
    >
      {message}
    </div>
  );
}