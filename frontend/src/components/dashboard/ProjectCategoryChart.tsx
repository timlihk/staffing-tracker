import React from 'react';
import { Box } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Section } from '../ui';

interface ProjectCategoryChartProps {
  data: Array<{ category: string; count: number }>;
}

const ProjectCategoryChart: React.FC<ProjectCategoryChartProps> = ({ data }) => {
  const chartData = data.map(c => ({
    name: c.category.replace('Projects', '').trim(),
    value: c.count,
  }));

  return (
    <Section title="Projects by Category">
      <Box sx={{ height: 350 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#003D7A" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Section>
  );
};

export default ProjectCategoryChart;
