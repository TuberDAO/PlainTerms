import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserQuestionAnswer } from "./user-question-answer";

describe("UserQuestionAnswer", () => {
  it("renders question and answer when both are provided", () => {
    render(
      <UserQuestionAnswer
        userQuestion="Can I cancel online?"
        userAnswer="No, you must cancel in person per clause 1."
      />,
    );
    expect(screen.getByText("Your question, answered")).toBeInTheDocument();
    expect(screen.getByText("Can I cancel online?")).toBeInTheDocument();
    expect(
      screen.getByText("No, you must cancel in person per clause 1."),
    ).toBeInTheDocument();
  });

  it("renders nothing when both fields are null", () => {
    const { container } = render(
      <UserQuestionAnswer userQuestion={null} userAnswer={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when userAnswer is null", () => {
    const { container } = render(
      <UserQuestionAnswer
        userQuestion="Can I cancel?"
        userAnswer={null}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when userQuestion is null", () => {
    const { container } = render(
      <UserQuestionAnswer
        userQuestion={null}
        userAnswer="Yes you can."
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
