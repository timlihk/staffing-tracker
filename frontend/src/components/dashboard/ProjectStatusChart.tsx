import React from 'react';
import { Box } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Section } from '../ui';

const COLORS = ['#4CAF50', '#FF9800', '#F44336', '#2196F3'];

interface ProjectStatusChartProps {
  data: Array<{ status: string; count: number }>;
}

const ProjectStatusChart: React.FC<ProjectStatusChartProps> = ({ data }) => {
  const chartData = data.map(s => ({ name: s.status, value: s.count }));

  return (
    <Section title="Projects by Status">
      <Box sx={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Section>
  );
};

export default ProjectStatusChart;
