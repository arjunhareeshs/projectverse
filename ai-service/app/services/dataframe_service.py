import pandas as pd


class DataframeService:
    def summarize(self, records: list[dict]) -> str:
        if not records:
            return 'No records supplied.'

        frame = pd.DataFrame(records)
        return f'Records: {len(frame)}, Columns: {len(frame.columns)}'


dataframe_service = DataframeService()
