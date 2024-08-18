import json
import os
import pandas as pd

folder = os.path.dirname(__file__)


def main():
    source = os.path.join(folder, "transactions.parquet")
    config_file = os.path.join(folder, "config.json")
    config = json.load(open(config_file))
    source_mtime = max(os.path.getmtime(src) for src in [source, config_file, __file__])

    for group, conf in config["groups"].items():
        target = os.path.join(folder, f"{group}.json")
        if os.path.exists(target) and source_mtime < os.path.getmtime(target):
            continue
        df = pd.read_parquet(source)
        grouped = df.groupby(conf["groups"]).agg(
            {
                "Amount": "sum",
                "Is Disputed?": "sum",
                "Is Fraud?": "sum",
                "Dispute Type": "count",
            }
        )
        grouped.rename(columns={"Dispute Type": "Count"}, inplace=True)
        grouped.reset_index().to_json(target, orient="records", double_precision=2)


if __name__ == "__main__":
    main()
