import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12/+esm";
import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";

import { num, pc } from "https://cdn.jsdelivr.net/npm/@gramex/ui/dist/format.js";
import {
  insightTree,
  INDEX,
  GROUP,
  LEVEL,
  RANK,
} from "https://cdn.jsdelivr.net/npm/@gramex/insighttree@3.2/dist/insighttree.js";

const $output = document.querySelector("#output");

const $loading = html`
  <div class="text-center my-5 fs-1">
    <div class="spinner-border text-center" style="width: 6rem; height: 6rem" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
`;

const config = await fetch("config.json").then((r) => r.json());
const metrics = config.metrics;

$output.replaceChildren();

render(
  Object.entries(config.groups).map(
    ([group, { title, info }]) => html`
      <section data-group="${group}">
        <h2 class="display-6 text-center mt-5 mb-3">${title}</h2>
        <p class="info link-rank">${unsafeHTML(marked.parse(info))}</p>
        <div id="tree-${group}">${$loading}</div>
      </section>
    `,
  ),
  $output,
);

const trees = {};

// Fetch all groups' data in parallel
Object.entries(config.groups).forEach(async ([group, { groups, leaf, start, showKey }]) => {
  const data = await fetch(`${group}.json`).then((r) => r.json());
  const $tree = document.querySelector(`#tree-${group}`);
  $tree.replaceChildren();
  const color = d3.scaleSequential(d3.interpolateRdYlGn).domain([0.04, 0.03]);
  const tree = (trees[group] = insightTree(`#tree-${group}`, {
    data: data,
    groups,
    metrics,
    sort: "-Is Fraud?",
    impact: (row) => (row["Is Fraud?"] / row["Count"]) * Math.log(row["Count"]) ** 1.5,
    render: (el, { tree }) =>
      render(
        html` <div class="text-center mt-3 fst-italic">Move the slider to step through insights one by one</div>
          <div><input id="level-${group}" type="range" min="1" max="30" value="${start}" class="form-range" /></div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Group</th>
                  <th class="text-end">Fraud</th>
                  <th class="text-end">Transactions</th>
                  <th class="text-end">Fraud rate</th>
                  <th class="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${tree.map((row) => {
                  const bg = color(row["Is Fraud?"] / row["Count"]);
                  return html`
                  <tr data-insight-level="${row[LEVEL]}" data-insight-rank="${row[RANK]}">
                    <td>#${row[RANK]}</th>
                    <td style="padding-left:${row[LEVEL] * 1.5}rem">
                      <span class="insight-toggle"></span>
                      ${row[LEVEL] && showKey ? `${groups[row[LEVEL] - 1]} = ` : ""} ${row[GROUP]}
                    </td>
                    <td class="text-end">${num(row["Is Fraud?"])}</td>
                    <td class="text-end">${num(row["Count"])}</td>
                    <td class="text-end contrast-color" style="background-color: ${bg}; color: ${contrast(bg)}">${pc(row["Is Fraud?"] / row["Count"])}</td>
                    <td class="text-end">$${num(row["Amount"])}</td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>`,
        $tree,
      ),
  }));
  const $level = document.querySelector(`#level-${group}`);
  const update = leaf ? (rank) => updateLeaf(tree, rank) : (rank) => tree.update({ rank });

  update($level.value);
  $level.addEventListener("input", (e) => update(e.target.value));
});

function updateLeaf(insightTree, rank) {
  rank = insightTree.tree[insightTree.leaves[rank - 1]]?.[RANK] ?? insightTree.tree.length;
  return insightTree
    .show((row) => row[RANK] <= rank && insightTree.leaves.includes(row[INDEX]))
    .classed("insight-highlight", (row) => row[RANK] <= rank)
    .classed("insight-current", (row) => row[RANK] == rank);
}

function contrast(color) {
  const { r, g, b } = d3.rgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128 ? "white" : "black";
}

$output.addEventListener("click", (e) => {
  if (e.target.matches(".link-rank a")) {
    e.preventDefault();
    const $group = e.target.closest("[data-group]");
    const rank = +e.target.href.split("#").at(-1);
    $group.querySelector(".form-range").value = rank;
    // Trigger input event
    $group.querySelector(".form-range").dispatchEvent(new Event("input", { bubbles: true }));
  }
});
