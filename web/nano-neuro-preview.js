"use strict";

const button = document.getElementById("run");
const count = document.getElementById("count");
const progress = document.getElementById("progress");
const progressBar = document.querySelector('[role="progressbar"]');
const status = document.getElementById("status");

if (button && count && progress && progressBar && status) {
  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Creating local virtual records…";
    let created = 0;
    const batch = 250;

    function step() {
      const end = Math.min(10_000, created + batch);
      for (let index = created; index < end; index++) {
        const virtualRecord = {
          id: `agent-${String(index + 1).padStart(5, "0")}`,
          kind: "digital-simulation-only"
        };
        void virtualRecord;
      }
      created = end;
      count.textContent = `${created.toLocaleString()} / 10,000`;
      progress.style.width = `${(created / 10_000) * 100}%`;
      progressBar.setAttribute("aria-valuenow", String(created));

      if (created < 10_000) {
        setTimeout(step, 0);
      } else {
        status.textContent = "Completed locally: 10,000 demonstration records. No external or physical actions.";
        button.disabled = false;
      }
    }
    step();
  });
}
