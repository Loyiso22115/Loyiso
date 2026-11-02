/*
   WEDES5020POE Part 1
   Nuru Creative Print & Design

   Features:
   1. Highlights the current page in the navigation
   2. Validates the enquiry form with inline error messages
   3. Makes the telephone number required when "Telephone" is the preferred contact method
   4. Shows a live character counter for the project details box
   5. Sends the enquiry to Formspree with fetch (AJAX) and shows a confirmation or error message
*/

document.addEventListener("DOMContentLoaded", function () {
    highlightCurrentPage();
    setupEnquiryForm();
});

/* ---------- 1. Navigation: mark the current page ---------- */
function highlightCurrentPage() {
    const links = document.querySelectorAll("nav a");
    let currentPage = window.location.pathname.split("/").pop();

    if (currentPage === "") {
        currentPage = "index.html";
    }

    links.forEach(function (link) {
        if (link.getAttribute("href") === currentPage) {
            link.setAttribute("aria-current", "page");
            link.classList.add("active");
        }
    });
}

/* ---------- 2. Enquiry form ---------- */
function setupEnquiryForm() {
    const form = document.querySelector("form");

    // Only runs on enquiry.html
    if (!form) {
        return;
    }

    const nameInput = document.getElementById("name");
    const emailInput = document.getElementById("email");
    const phoneInput = document.getElementById("telephone");
    const serviceSelect = document.getElementById("service");
    const detailsInput = document.getElementById("details");
    const contactRadios = form.querySelectorAll('input[name="contact-method"]');

    const MIN_DETAILS = 20;
    const MAX_DETAILS = 1000;

    detailsInput.setAttribute("maxlength", MAX_DETAILS);

    // Turn off the browser's default pop-up bubbles so our messages show instead
    form.setAttribute("novalidate", "novalidate");

    // Live character counter
    const counter = document.createElement("small");
    counter.id = "details-counter";
    counter.setAttribute("aria-live", "polite");
    detailsInput.insertAdjacentElement("afterend", counter);

    function updateCounter() {
        counter.textContent = " " + detailsInput.value.length + " / " + MAX_DETAILS + " characters";
    }
    detailsInput.addEventListener("input", updateCounter);
    updateCounter();

    // Validation rules: each returns an error message, or "" if the value is fine
    const rules = [
        {
            field: nameInput,
            check: function (value) {
                if (value === "") return "Please enter your full name.";
                if (!/^[\p{L}][\p{L}\s'-]+$/u.test(value)) return "Names can only contain letters, spaces, hyphens and apostrophes.";
                return "";
            }
        },
        {
            field: emailInput,
            check: function (value) {
                if (value === "") return "Please enter your email address.";
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return "Please enter a valid email address, e.g. name@example.com.";
                return "";
            }
        },
        {
            field: phoneInput,
            check: function (value) {
                const wantsPhone = getContactMethod() === "phone";

                if (value === "") {
                    return wantsPhone ? "Please enter a telephone number, since you chose telephone as your contact method." : "";
                }

                // Allow spaces, dashes and brackets, then check South African format
                const cleaned = value.replace(/[\s\-()]/g, "");
                if (!/^(\+27|0)\d{9}$/.test(cleaned)) return "Please enter a valid South African number, e.g. 010 000 0000 or +27 10 000 0000.";
                return "";
            }
        },
        {
            field: serviceSelect,
            check: function (value) {
                return value === "" ? "Please select a service." : "";
            }
        },
        {
            field: detailsInput,
            check: function (value) {
                if (value === "") return "Please tell us about your project.";
                if (value.length < MIN_DETAILS) return "Please give us a little more detail (at least " + MIN_DETAILS + " characters).";
                return "";
            }
        }
    ];

    function getContactMethod() {
        const selected = form.querySelector('input[name="contact-method"]:checked');
        return selected ? selected.value : "email";
    }

    // Show or clear an error for one field
    function showError(field, message) {
        let errorBox = document.getElementById(field.id + "-error");

        if (!errorBox) {
            errorBox = document.createElement("span");
            errorBox.id = field.id + "-error";
            errorBox.className = "error-message";
            errorBox.setAttribute("role", "alert");
            // Place the message after the counter for the textarea, otherwise right after the field
            const anchor = field === detailsInput ? counter : field;
            anchor.insertAdjacentElement("afterend", errorBox);
        }

        errorBox.textContent = message;
        field.setAttribute("aria-invalid", message ? "true" : "false");
        field.setAttribute("aria-describedby", errorBox.id);
        field.classList.toggle("input-error", message !== "");
    }

    function validateRule(rule) {
        const message = rule.check(rule.field.value.trim());
        showError(rule.field, message);
        return message === "";
    }

    // Validate each field as the user leaves it, and clear errors as they fix them
    rules.forEach(function (rule) {
        rule.field.addEventListener("blur", function () {
            validateRule(rule);
        });
        rule.field.addEventListener("input", function () {
            if (rule.field.classList.contains("input-error")) {
                validateRule(rule);
            }
        });
    });

    // Re-check the phone field when the contact method changes
    contactRadios.forEach(function (radio) {
        radio.addEventListener("change", function () {
            validateRule(rules[2]);
        });
    });

    /* ---------- Submit (sent to Formspree) ---------- */
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        let allValid = true;
        let firstInvalid = null;

        rules.forEach(function (rule) {
            if (!validateRule(rule)) {
                allValid = false;
                if (!firstInvalid) firstInvalid = rule.field;
            }
        });

        if (!allValid) {
            firstInvalid.focus();
            return;
        }

        // Keep these before the form is reset
        const name = nameInput.value.trim();
        const service = serviceSelect.options[serviceSelect.selectedIndex].text.trim();
        const method = getContactMethod() === "phone" ? "telephone" : "email";

        const submitButton = form.querySelector('button[type="submit"]');
        const originalLabel = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";

        try {
            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
                headers: { Accept: "application/json" }
            });

            if (response.ok) {
                showStatus("Thank you, " + name + ". We have received your " + service +
                    " enquiry and will contact you by " + method + " shortly.", false);

                form.reset();
                updateCounter();
                rules.forEach(function (rule) {
                    showError(rule.field, "");
                });
            } else {
                // Formspree returns { errors: [{ message: "..." }] } when something is wrong
                const data = await response.json().catch(function () { return {}; });
                const detail = data.errors && data.errors.length
                    ? data.errors.map(function (e) { return e.message; }).join(" ")
                    : "Something went wrong while sending your enquiry.";
                showStatus(detail + " Please try again, or email us at hello@nurucpd.com.", true);
            }
        } catch (error) {
            showStatus("We could not reach the server. Please check your internet connection and try again.", true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    });

    /* ---------- Success / error message above the form ---------- */
    function showStatus(message, isError) {
        let box = document.getElementById("enquiry-status");

        if (!box) {
            box = document.createElement("div");
            box.id = "enquiry-status";
            form.insertAdjacentElement("beforebegin", box);
        }

        box.className = isError ? "form-error" : "form-success";
        box.setAttribute("role", isError ? "alert" : "status");

        // textContent keeps user input from being treated as HTML
        box.textContent = message;
        box.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}
